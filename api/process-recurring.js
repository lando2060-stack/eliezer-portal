/**
 * Vercel Cron Job — יוצר הוצאות מהוצאות קבועות פעם ביום
 * מופעל אוטומטית כל יום בחצות שעון ישראל (22:00 UTC)
 * GET /api/process-recurring
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Vercel מגן על cron endpoints עם Authorization header
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // חשב את היום הנוכחי בשעון ישראל
  const nowIsrael = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const dayOfMonth = nowIsrael.getDate();
  const dateStr = nowIsrael.toISOString().split('T')[0];
  const monthStr = `${nowIsrael.getFullYear()}-${String(nowIsrael.getMonth() + 1).padStart(2, '0')}`;

  // שלוף הוצאות קבועות פעילות שמיועדות להיום
  const { data: recurring, error: fetchErr } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('is_active', true)
    .eq('day_of_month', dayOfMonth);

  if (fetchErr) {
    console.error('Failed to fetch recurring expenses:', fetchErr);
    return res.status(500).json({ error: fetchErr.message });
  }

  if (!recurring || recurring.length === 0) {
    return res.status(200).json({ processed: 0, date: dateStr });
  }

  // בדוק שלא נוצרה כבר הוצאה לאותו חודש (מניעת כפילות)
  const created = [];
  for (const r of recurring) {
    const { data: existing } = await supabase
      .from('expenses')
      .select('id')
      .eq('notes', `הוצאה קבועה: ${r.name}`)
      .gte('date', `${monthStr}-01`)
      .lte('date', `${monthStr}-31`)
      .limit(1);

    if (existing && existing.length > 0) continue; // כבר נוצרה החודש

    const { error: insertErr } = await supabase.from('expenses').insert({
      vendor_name: r.vendor_name || r.name,
      total_amount: r.amount || 0,
      category: r.category || '',
      payment_method: r.payment_method || '',
      date: dateStr,
      status: 'approved',
      scope: 'office',
      has_receipt: false,
      currency: 'ILS',
      document_type: 'receipt',
      notes: `הוצאה קבועה: ${r.name}`,
    });

    if (!insertErr) created.push(r.name);
  }

  console.log(`process-recurring: created ${created.length} expenses on ${dateStr}`);
  return res.status(200).json({ processed: created.length, created, date: dateStr });
}
