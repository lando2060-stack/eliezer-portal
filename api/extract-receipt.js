/**
 * Vercel serverless function — extracts structured data from a receipt image
 * using OpenAI GPT-4 Vision.
 * POST /api/extract-receipt
 * Body: { file_url: string, json_schema: object }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { file_url, json_schema } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url is required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const schemaDescription = json_schema
      ? `Return a JSON object matching this schema: ${JSON.stringify(json_schema)}`
      : 'Return a JSON object with all relevant receipt fields.';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a receipt data extractor. Extract all relevant information from this receipt image. ${schemaDescription} Return ONLY valid JSON, no markdown, no explanation.`,
              },
              {
                type: 'image_url',
                image_url: { url: file_url, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return res.status(200).json({ status: 'error', output: null });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    try {
      const jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const output = JSON.parse(jsonStr);
      return res.status(200).json({ status: 'success', output });
    } catch {
      return res.status(200).json({ status: 'error', output: null });
    }
  } catch (err) {
    console.error('extract-receipt error:', err);
    return res.status(200).json({ status: 'error', output: null });
  }
}
