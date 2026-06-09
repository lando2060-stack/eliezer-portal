/**
 * GET /api/check-openai
 * Tests whether GEMINI_API_KEY is set and valid.
 * (Kept at same path so Settings.jsx doesn't need changes.)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      connected: false,
      reason: 'GEMINI_API_KEY לא מוגדר ב-Vercel → Environment Variables',
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (response.ok) {
      return res.status(200).json({ connected: true });
    }

    const data = await response.json().catch(() => ({}));
    return res.status(200).json({
      connected: false,
      reason: data?.error?.message || `HTTP ${response.status}`,
    });
  } catch (err) {
    return res.status(200).json({ connected: false, reason: err.message });
  }
}
