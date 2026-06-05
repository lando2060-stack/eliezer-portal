/**
 * GET /api/google/callback
 * Handles OAuth callback from Google, stores tokens, creates Drive folder
 */
import { createClient } from '@supabase/supabase-js';

async function getTokens(code, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error('Failed to exchange code for tokens');
  return res.json();
}

async function getConnectedEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.email || '';
}

async function getOrCreateFolder(accessToken) {
  const folderName = 'קבלות - אליעזר נכסים';

  // Check if folder already exists
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

export default async function handler(req, res) {
  const { code, error } = req.query;
  const siteUrl = process.env.SITE_URL || 'https://tfila.fyotek.com';

  if (error || !code) {
    return res.redirect(`${siteUrl}/settings?drive=error`);
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const redirectUri = `${siteUrl}/api/google/callback`;
    const tokens = await getTokens(code, redirectUri);
    const email = await getConnectedEmail(tokens.access_token);
    const folderId = await getOrCreateFolder(tokens.access_token);

    // Delete old integration if exists
    await supabase.from('google_integrations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Store new integration
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    await supabase.from('google_integrations').insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      drive_folder_id: folderId,
      connected_email: email,
    });

    return res.redirect(`${siteUrl}/settings?drive=connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(`${siteUrl}/settings?drive=error`);
  }
}
