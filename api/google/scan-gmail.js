/**
 * POST /api/google/scan-gmail
 * Scans Gmail for receipt/invoice attachments (PDF + images), uploads them to
 * Supabase Storage, runs AI extraction, and creates Expense records with
 * status "pending_approval". Each message ID is tracked so re-scans skip
 * already-processed emails.
 *
 * Requires: Authorization: Bearer <supabase_access_token>
 * Returns:  { found: number, created: number }
 */
import { createClient } from '@supabase/supabase-js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
]);

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Google token');
  return res.json();
}

async function getValidAccessToken(integration, supabase) {
  const expiresAt = new Date(integration.expires_at);
  if (!integration.access_token || expiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
    const newTokens = await refreshAccessToken(integration.refresh_token);
    const newExpiresAt = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();
    await supabase
      .from('google_integrations')
      .update({ access_token: newTokens.access_token, expires_at: newExpiresAt })
      .eq('id', integration.id);
    return newTokens.access_token;
  }
  return integration.access_token;
}

async function getLabelId(accessToken, labelName) {
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const label = (data.labels || []).find(l => l.name === labelName);
  return label?.id || null;
}

async function listMessages(accessToken, maxResults = 50) {
  // Scan only the "חשבוניות" label — if it doesn't exist fall back to attachment search
  const labelId = await getLabelId(accessToken, 'חשבוניות');

  const params = new URLSearchParams({ maxResults });
  if (labelId) {
    params.set('labelIds', labelId);
  } else {
    params.set('q', 'has:attachment newer_than:30d label:חשבוניות');
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.messages || [];
}

async function getMessage(accessToken, messageId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.json();
}

async function getAttachmentData(accessToken, messageId, attachmentId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.data || null;
}

function extractAttachmentParts(payload, parts = []) {
  if (payload.filename && payload.body?.attachmentId && ALLOWED_MIME.has(payload.mimeType)) {
    const disposition = (payload.headers?.find(h => h.name.toLowerCase() === 'content-disposition')?.value || '').toLowerCase();
    const isPdf = payload.mimeType === 'application/pdf';
    const isExplicitAttachment = disposition.startsWith('attachment');
    // PDFs always included; images only if explicitly attached (skip inline logos/signatures)
    if (!isPdf && !isExplicitAttachment) {
      // skip inline image
    } else {
      parts.push({
        filename: payload.filename,
        mimeType: payload.mimeType,
        attachmentId: payload.body.attachmentId,
      });
    }
  }
  if (payload.parts) {
    for (const part of payload.parts) extractAttachmentParts(part, parts);
  }
  return parts;
}

function base64urlToBytes(b64url) {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: integration } = await supabase
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('service', 'gmail')
    .single();

  if (!integration) return res.status(400).json({ error: 'Gmail not connected' });

  try {
    const accessToken = await getValidAccessToken(integration, supabase);
    const messages = await listMessages(accessToken);

    if (!messages.length) return res.status(200).json({ found: 0, created: 0 });

    // Filter out already-processed message IDs
    const { data: processed } = await supabase
      .from('processed_gmail_messages')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messages.map(m => m.id));

    const processedSet = new Set((processed || []).map(p => p.message_id));
    const newMessages = messages.filter(m => !processedSet.has(m.id));

    let created = 0;
    const deadline = Date.now() + 8000; // stop before Vercel's 10s timeout

    for (const msg of newMessages) {
      if (Date.now() > deadline) break;
      try {
        const message = await getMessage(accessToken, msg.id);
        const parts = extractAttachmentParts(message.payload);

        // Skip messages with no processable attachments
        if (parts.length === 0) {
          await supabase.from('processed_gmail_messages').upsert(
            { user_id: user.id, message_id: msg.id },
            { onConflict: 'user_id,message_id', ignoreDuplicates: true }
          );
          continue;
        }

        for (const part of parts.slice(0, 2)) {
          try {
            const b64data = await getAttachmentData(accessToken, msg.id, part.attachmentId);
            if (!b64data) continue;

            const bytes = base64urlToBytes(b64data);
            const ext = part.filename.split('.').pop().toLowerCase() ||
              (part.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
            const storagePath = `gmail_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from('receipts')
              .upload(storagePath, bytes, { contentType: part.mimeType, upsert: false });

            if (uploadError) continue;

            const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(storagePath);
            const fileUrl = urlData.publicUrl;

            // Save without AI extraction — user will extract manually from the inbox tab
            const subjectHeader = message.payload?.headers?.find(h => h.name === 'Subject');
            const fromHeader = message.payload?.headers?.find(h => h.name === 'From');
            const dateHeader = message.payload?.headers?.find(h => h.name === 'Date');
            const emailDate = dateHeader?.value ? (() => {
              const d = new Date(dateHeader.value);
              return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
            })() : null;
            await supabase.from('expenses').insert({
              receipt_url: fileUrl,
              has_receipt: true,
              status: 'gmail_inbox',
              date: emailDate,
              notes: [
                subjectHeader?.value ? `נושא: ${subjectHeader.value}` : '',
                fromHeader?.value ? `מאת: ${fromHeader.value}` : '',
              ].filter(Boolean).join(' | ') || 'ממייל — ממתין לחילוץ פרטים',
              currency: 'ILS',
              created_by_id: user.id,
              vendor_name: part.filename || '',
            });

            created++;
          } catch { /* per-attachment failure is non-fatal */ }
        }

        // Mark message as processed whether or not we found valid attachments
        await supabase.from('processed_gmail_messages').upsert(
          { user_id: user.id, message_id: msg.id },
          { onConflict: 'user_id,message_id', ignoreDuplicates: true }
        );
      } catch { /* per-message failure is non-fatal */ }
    }

    return res.status(200).json({ found: newMessages.length, created });
  } catch (err) {
    console.error('scan-gmail error:', err);
    return res.status(500).json({ error: err.message });
  }
}
