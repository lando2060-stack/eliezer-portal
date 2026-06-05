/**
 * GET /api/google/auth-url
 * Returns the Google OAuth URL to redirect the user to
 */
export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.SITE_URL}/api/google/callback`;
  const scope = 'https://www.googleapis.com/auth/drive.file';

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  res.status(200).json({ url: url.toString() });
}
