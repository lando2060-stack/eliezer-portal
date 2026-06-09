/**
 * GET /api/check-openai
 * Tests whether the OPENAI_API_KEY is set and valid by calling the models list.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ connected: false, reason: 'OPENAI_API_KEY not set in environment variables' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

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
