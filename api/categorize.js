/**
 * POST /api/categorize
 * Body: { prompt: string }
 * Returns: { result: string }
 *
 * Uses Gemini 2.0 Flash for category suggestion.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ result: '' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 50 },
        }),
      }
    );

    if (!response.ok) return res.status(200).json({ result: '' });

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return res.status(200).json({ result });
  } catch (err) {
    console.error('categorize error:', err.message);
    return res.status(200).json({ result: '' });
  }
}
