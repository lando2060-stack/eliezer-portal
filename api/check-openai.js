export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      connected: false,
      reason: 'GEMINI_API_KEY לא מוגדר ב-Vercel → Environment Variables',
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();

    if (response.ok) {
      const models = (data.models || []).map(m => m.name.replace('models/', ''));
      const flash = models.find(m => m.includes('flash')) || models[0];
      return res.status(200).json({ connected: true, model: flash, total: models.length });
    }

    return res.status(200).json({
      connected: false,
      reason: data?.error?.message || `HTTP ${response.status}`,
    });
  } catch (err) {
    return res.status(200).json({ connected: false, reason: err.message });
  }
}
