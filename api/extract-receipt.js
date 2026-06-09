/**
 * POST /api/extract-receipt
 * Body: { file_url: string, json_schema?: object }
 *
 * Images: passes URL directly to GPT-4o Vision (fast, no download needed).
 * PDFs:   uploads to OpenAI Files API → references file_id in the message,
 *         then deletes the temporary file.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { file_url, json_schema } = req.body;
  if (!file_url) return res.status(400).json({ error: 'file_url is required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const schemaDescription = json_schema
    ? `Return a JSON object matching this schema: ${JSON.stringify(json_schema)}`
    : 'Return a JSON object with all relevant receipt/invoice fields.';

  const systemPrompt = `You are a receipt/invoice data extractor for an Israeli real-estate agency.
Extract all information from this document.
${schemaDescription}
Rules:
- Dates must be YYYY-MM-DD format
- Amounts must be plain numbers (not strings), no currency symbols
- currency field: use ILS unless clearly otherwise
- If a field is not present, omit it (don't include null values)
Return ONLY valid JSON — no markdown, no explanation, no code block.`;

  try {
    const isPdf = file_url.toLowerCase().includes('.pdf') || file_url.toLowerCase().includes('pdf');

    let messageContent;

    if (isPdf) {
      // ── PDF: upload to OpenAI Files API ──────────────────────────────
      let fileId = null;
      try {
        const fileRes = await fetch(file_url);
        if (!fileRes.ok) throw new Error('fetch failed');
        const buf = await fileRes.arrayBuffer();

        const form = new FormData();
        form.append('file', new Blob([buf], { type: 'application/pdf' }), 'receipt.pdf');
        form.append('purpose', 'vision');

        const uploadRes = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
        const uploadData = await uploadRes.json();
        fileId = uploadData?.id;
      } catch (e) {
        console.error('PDF upload error:', e);
      }

      if (fileId) {
        messageContent = [
          { type: 'text', text: systemPrompt },
          { type: 'file', file: { file_id: fileId } },
        ];
      } else {
        // Fallback: try URL (works only if publicly accessible)
        messageContent = [
          { type: 'text', text: systemPrompt },
          { type: 'image_url', image_url: { url: file_url, detail: 'high' } },
        ];
      }
    } else {
      // ── Image: pass URL directly (no download, fast) ─────────────────
      messageContent = [
        { type: 'text', text: systemPrompt },
        { type: 'image_url', image_url: { url: file_url, detail: 'high' } },
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
        messages: [{ role: 'user', content: messageContent }],
        max_tokens: 1000,
        temperature: 0,
      }),
    });

    // Clean up temporary OpenAI file (non-blocking)
    const fileIdForCleanup = isPdf && messageContent[1]?.file?.file_id;
    if (fileIdForCleanup) {
      fetch(`https://api.openai.com/v1/files/${fileIdForCleanup}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => {});
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', errText);
      return res.status(200).json({ status: 'error', output: null, detail: errText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    try {
      const jsonStr = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const output = JSON.parse(jsonStr);
      return res.status(200).json({ status: 'success', output });
    } catch {
      console.error('JSON parse failed. Raw content:', content);
      return res.status(200).json({ status: 'error', output: null, detail: 'JSON parse failed' });
    }
  } catch (err) {
    console.error('extract-receipt error:', err);
    return res.status(200).json({ status: 'error', output: null, detail: err.message });
  }
}
