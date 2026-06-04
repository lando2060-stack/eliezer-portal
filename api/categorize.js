/**
 * Vercel serverless function — calls OpenAI to suggest a category for a vendor.
 * POST /api/categorize
 * Body: { prompt: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      return res.status(200).json({ result: '' });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || '';
    return res.status(200).json({ result });
  } catch (err) {
    console.error('categorize error:', err);
    return res.status(200).json({ result: '' });
  }
}
