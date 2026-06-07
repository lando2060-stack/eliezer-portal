/**
 * POST /api/google/upload-to-drive
 * Downloads file from Supabase Storage URL and uploads to Google Drive.
 * Requires: Authorization: Bearer <supabase_access_token>
 * Body: { file_url, file_name, mime_type? }
 */
import { createClient } from '@supabase/supabase-js';

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
  const now = new Date();
  const expiresAt = new Date(integration.expires_at);

  if (!integration.access_token || expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
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

async function getOrCreateMonthFolder(accessToken, parentFolderId) {
  const now = new Date();
  const monthName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${monthName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: monthName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { file_url, file_name, mime_type = 'application/octet-stream' } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url required' });

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
    .single();

  if (!integration) return res.status(200).json({ skipped: true, reason: 'Drive not connected' });

  try {
    const accessToken = await getValidAccessToken(integration, supabase);
    const monthFolderId = await getOrCreateMonthFolder(accessToken, integration.drive_folder_id);

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) throw new Error('Failed to download file from Supabase');
    const fileBuffer = await fileRes.arrayBuffer();

    const name = file_name || file_url.split('/').pop() || 'receipt';

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = JSON.stringify({ name, parents: [monthFolderId] });
    const metaPart = `${delimiter}Content-Type: application/json\r\n\r\n${metadata}`;
    const filePart = `${delimiter}Content-Type: ${mime_type}\r\n\r\n`;

    const metaBytes = new TextEncoder().encode(metaPart);
    const filePartBytes = new TextEncoder().encode(filePart);
    const closeBytes = new TextEncoder().encode(closeDelimiter);
    const fileBytes = new Uint8Array(fileBuffer);

    const body = new Uint8Array(metaBytes.length + filePartBytes.length + fileBytes.length + closeBytes.length);
    body.set(metaBytes, 0);
    body.set(filePartBytes, metaBytes.length);
    body.set(fileBytes, metaBytes.length + filePartBytes.length);
    body.set(closeBytes, metaBytes.length + filePartBytes.length + fileBytes.length);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Drive upload failed: ${err}`);
    }

    const driveFile = await uploadRes.json();
    return res.status(200).json({ success: true, driveFileId: driveFile.id, driveUrl: driveFile.webViewLink });
  } catch (err) {
    console.error('upload-to-drive error:', err);
    return res.status(200).json({ success: false, error: err.message });
  }
}
