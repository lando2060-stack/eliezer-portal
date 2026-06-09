/**
 * POST /api/extract-receipt
 * Body: { file_url: string, json_schema?: object }
 *
 * Uses Gemini 2.0 Flash — supports images AND PDFs natively.
 * Downloads the file, sends as inline_data (base64) → always works
 * regardless of bucket visibility.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { file_url, json_schema } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const schemaStr = json_schema ? JSON.stringify(json_schema) : null;
  const extractInstruction = schemaStr
    ? `Return a JSON object matching this schema: ${schemaStr}`
    : 'Return a JSON object with all relevant receipt/invoice fields.';

  const prompt = `You are a receipt/invoice data extractor for an Israeli real-estate agency.
${extractInstruction}
Rules:
- Dates → YYYY-MM-DD
- Amounts → plain numbers, no ₪ symbols
- Currency → ILS unless clearly otherwise
- Omit fields that are not present in the document
Return ONLY valid JSON — no markdown, no explanation.`;

  try {
    // Download the file
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);
    const buf = await fileRes.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');

    // Determine MIME type
    const ct = fileRes.headers.get('content-type') || '';
    let mimeType = ct.split(';')[0].trim();
    if (!mimeType || mimeType === 'application/octet-stream') {
      const lower = file_url.toLowerCase();
      if (lower.includes('.pdf')) mimeType = 'application/pdf';
      else if (lower.includes('.png')) mimeType = 'image/png';
      else if (lower.includes('.webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', errText);
      const isQuota = response.status === 429;
      return res.status(200).json({
        status: 'error',
        output: null,
        detail: isQuota
          ? 'חרגת ממגבלת הקוטה של Gemini — המתן דקה ונסה שוב, או הפעל חיוב ב-Google Cloud Console'
          : errText.slice(0, 300),
      });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!content) {
      return res.status(200).json({ status: 'error', output: null, detail: 'Empty response from Gemini' });
    }

    try {
      // Gemini with responseMimeType:application/json returns clean JSON
      const output = JSON.parse(content);
      if (typeof output !== 'object' || output === null || Array.isArray(output)) {
        throw new Error('not an object');
      }
      return res.status(200).json({ status: 'success', output });
    } catch {
      console.error('JSON parse failed. Raw:', content.slice(0, 300));
      return res.status(200).json({ status: 'error', output: null, detail: 'JSON parse failed' });
    }
  } catch (err) {
    console.error('extract-receipt error:', err.message);
    return res.status(200).json({ status: 'error', output: null, detail: err.message });
  }
}
