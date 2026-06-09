/**
 * Vercel serverless function — extracts structured data from a receipt image
 * using OpenAI GPT-4o Vision.
 * POST /api/extract-receipt
 * Body: { file_url: string, json_schema?: object }
 *
 * Downloads the file first and sends it as base64 so private Supabase Storage
 * URLs work correctly (OpenAI servers cannot access signed/private URLs).
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
    // Download the file so we can send it as base64 (avoids private-bucket access issues)
    let imageContent;
    try {
      const fileRes = await fetch(file_url, { signal: AbortSignal.timeout(15000) });
      if (!fileRes.ok) throw new Error(`fetch ${fileRes.status}`);
      const buf = await fileRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      const ct = fileRes.headers.get('content-type') || 'image/jpeg';

      if (ct === 'application/pdf' || file_url.toLowerCase().includes('.pdf')) {
        // GPT-4o Vision does not support PDFs as base64; fall back to URL
        imageContent = { type: 'image_url', image_url: { url: file_url, detail: 'high' } };
      } else {
        const safeType = ct.startsWith('image/') ? ct : 'image/jpeg';
        imageContent = { type: 'image_url', image_url: { url: `data:${safeType};base64,${b64}`, detail: 'high' } };
      }
    } catch {
      // If download fails, fall back to URL (public bucket)
      imageContent = { type: 'image_url', image_url: { url: file_url, detail: 'high' } };
    }

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
                text: `You are a receipt/invoice data extractor for an Israeli real-estate agency. Extract all relevant information from this receipt or invoice image. ${schemaDescription} Rules: dates must be YYYY-MM-DD, amounts must be numbers (not strings), currency should be ILS unless clearly otherwise. Return ONLY valid JSON, no markdown, no explanation.`,
              },
              imageContent,
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
      const jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      const output = JSON.parse(jsonStr);
      return res.status(200).json({ status: 'success', output });
    } catch {
      console.error('JSON parse error, raw content:', content);
      return res.status(200).json({ status: 'error', output: null });
    }
  } catch (err) {
    console.error('extract-receipt error:', err);
    return res.status(200).json({ status: 'error', output: null });
  }
}
