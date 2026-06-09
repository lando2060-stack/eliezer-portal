/**
 * POST /api/extract-receipt
 * Body: { file_url: string, json_schema?: object }
 * Uses Claude claude-haiku-4-5 — supports images and PDFs natively via base64.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { file_url, json_schema } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const schemaStr = json_schema ? JSON.stringify(json_schema) : null;
  const prompt = `You are a receipt/invoice data extractor for an Israeli real-estate agency.
The document is likely in Hebrew. Read Hebrew text carefully and accurately.
${schemaStr ? `Return a JSON object matching this schema: ${schemaStr}` : 'Return a JSON object with all relevant receipt/invoice fields.'}
Rules:
- Dates → YYYY-MM-DD format (Israeli dates are DD/MM/YYYY — convert correctly)
- Amounts → plain numbers only, no ₪ or currency symbols
- currency → "ILS" unless clearly otherwise
- vendor_name → exact Hebrew business name as written
- Omit fields not present in the document
- Double-check all numbers for accuracy
Return ONLY valid JSON — no markdown, no code block, no explanation.`;

  try {
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);
    const buf = await fileRes.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');

    const ct = fileRes.headers.get('content-type') || '';
    let mimeType = ct.split(';')[0].trim();
    if (!mimeType || mimeType === 'application/octet-stream') {
      const lower = file_url.toLowerCase();
      if (lower.includes('.pdf')) mimeType = 'application/pdf';
      else if (lower.includes('.png')) mimeType = 'image/png';
      else if (lower.includes('.webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    const isPdf = mimeType === 'application/pdf';

    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [contentBlock, { type: 'text', text: prompt }],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude error:', errText);
      return res.status(200).json({ status: 'error', output: null, detail: errText.slice(0, 300) });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text?.trim() || '';

    try {
      // Try multiple strategies to extract JSON
      let output = null;

      // 1. Direct parse
      try { output = JSON.parse(content); } catch {}

      // 2. Strip markdown code block
      if (!output) {
        const stripped = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/m, '').trim();
        try { output = JSON.parse(stripped); } catch {}
      }

      // 3. Find first {...} block anywhere in the text
      if (!output) {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) try { output = JSON.parse(match[0]); } catch {}
      }

      if (!output || typeof output !== 'object' || Array.isArray(output)) {
        console.error('JSON parse failed. Raw:', content.slice(0, 500));
        return res.status(200).json({ status: 'error', output: null, detail: `JSON parse failed. Claude said: ${content.slice(0, 200)}` });
      }

      return res.status(200).json({ status: 'success', output });
    } catch (parseErr) {
      return res.status(200).json({ status: 'error', output: null, detail: `Parse error: ${parseErr.message}` });
    }
  } catch (err) {
    console.error('extract-receipt error:', err.message);
    return res.status(200).json({ status: 'error', output: null, detail: err.message });
  }
}
