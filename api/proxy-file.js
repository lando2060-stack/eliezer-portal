/**
 * GET /api/proxy-file?url=ENCODED_SUPABASE_URL
 * Fetches a Supabase storage file server-side and streams it to the client.
 * Needed because NetFree blocks direct browser requests to Supabase storage CDN.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  const decoded = decodeURIComponent(url);

  // Security: only proxy Supabase storage URLs for this project
  const ALLOWED_PREFIX = 'https://wdvbdsicslavrscojwcw.supabase.co/storage/';
  if (!decoded.startsWith(ALLOWED_PREFIX)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  try {
    const upstream = await fetch(decoded);
    if (!upstream.ok) return res.status(upstream.status).end();

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = await upstream.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buf));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
