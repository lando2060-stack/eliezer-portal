/**
 * POST /api/extract-receipt
 * Body: { file_url: string, json_schema?: object }
 *
 * Images → passes URL directly to GPT-4o Vision (fast, no download).
 * PDFs   → downloads, extracts text with pdf-parse, sends as text prompt
 *           (works reliably for all digitally-generated Israeli invoices).
 */
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { file_url, json_schema } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url is required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const schemaStr = json_schema ? JSON.stringify(json_schema) : null;
  const extractInstruction = schemaStr
    ? `Return a JSON object matching this schema: ${schemaStr}`
    : 'Return a JSON object with all relevant receipt/invoice fields.';

  const basePrompt = `You are a receipt/invoice data extractor for an Israeli real-estate agency.
${extractInstruction}
Rules:
- Dates → YYYY-MM-DD
- Amounts → plain numbers (no ₪ symbols)
- Currency → ILS unless clearly otherwise
- Omit fields that are not present
Return ONLY valid JSON — no markdown, no explanation.`;

  try {
    const isPdf = /\.pdf(\?|$)/i.test(file_url) || file_url.toLowerCase().includes('pdf');

    let messages;

    if (isPdf) {
      // ── PDF: extract text, send as text prompt ────────────────────────────
      let pdfText = '';
      try {
        const resp = await fetch(file_url);
        if (!resp.ok) throw new Error(`fetch ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        const parsed = await pdfParse(buf);
        pdfText = parsed.text?.trim() || '';
      } catch (e) {
        console.error('PDF text extraction failed:', e.message);
      }

      if (!pdfText) {
        return res.status(200).json({ status: 'error', output: null, detail: 'Could not extract text from PDF' });
      }

      messages = [
        {
          role: 'user',
          content: `${basePrompt}\n\nPDF text content:\n---\n${pdfText.slice(0, 6000)}\n---`,
        },
      ];
    } else {
      // ── Image: pass URL directly to Vision ───────────────────────────────
      messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: basePrompt },
            { type: 'image_url', image_url: { url: file_url, detail: 'high' } },
          ],
        },
      ];
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 1000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', errText);
      return res.status(200).json({ status: 'error', output: null, detail: errText.slice(0, 300) });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '';

    try {
      const jsonStr = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const output = JSON.parse(jsonStr);
      if (typeof output !== 'object' || output === null || Array.isArray(output)) {
        throw new Error('not an object');
      }
      return res.status(200).json({ status: 'success', output });
    } catch {
      console.error('JSON parse failed. Raw:', rawContent.slice(0, 500));
      return res.status(200).json({ status: 'error', output: null, detail: 'JSON parse failed' });
    }
  } catch (err) {
    console.error('extract-receipt error:', err.message);
    return res.status(200).json({ status: 'error', output: null, detail: err.message });
  }
}
