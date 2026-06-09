/**
 * GET /api/check-openai  —  Tests ANTHROPIC_API_KEY validity.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      connected: false,
      reason: 'ANTHROPIC_API_KEY לא מוגדר ב-Vercel → Environment Variables',
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (response.ok) return res.status(200).json({ connected: true });

    const data = await response.json().catch(() => ({}));
    return res.status(200).json({
      connected: false,
      reason: data?.error?.message || `HTTP ${response.status}`,
    });
  } catch (err) {
    return res.status(200).json({ connected: false, reason: err.message });
  }
}
