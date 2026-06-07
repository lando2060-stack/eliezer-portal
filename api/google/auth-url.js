/**
 * GET /api/google/auth-url
 * Returns the Google OAuth URL for the authenticated user.
 * Requires: Authorization: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = process.env.SITE_URL || 'https://tfila.fyotek.com';
  const redirectUri = `${siteUrl}/api/google/callback`;

  const scope = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.readonly',
  ].join(' ');

  // Encode user_id in state so callback knows which user to store tokens for
  const state = Buffer.from(user.id).toString('base64');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return res.status(200).json({ url: url.toString() });
}
