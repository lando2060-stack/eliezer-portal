export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ error: 'no key' });

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await r.json();
  const names = (data.models || []).map(m => m.name);
  return res.status(200).json({ status: r.status, models: names, raw: data.error || null });
}
