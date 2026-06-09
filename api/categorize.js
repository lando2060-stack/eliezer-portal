/**
 * POST /api/categorize  —  Uses Claude Haiku for category suggestion.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ result: '' });

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
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) return res.status(200).json({ result: '' });
    const data = await response.json();
    const result = data.content?.[0]?.text?.trim() || '';
    return res.status(200).json({ result });
  } catch {
    return res.status(200).json({ result: '' });
  }
}
