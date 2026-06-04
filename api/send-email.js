/**
 * Vercel serverless — שולח מיילים דרך Resend
 * POST /api/send-email
 * Body: { to, subject, html, type }
 * Types: 'agent_approved' | 'expense_approved' | 'expense_rejected' | 'custom'
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  const { to, subject, html, type, data = {} } = req.body;
  if (!to) return res.status(400).json({ error: 'to is required' });

  const fromEmail = process.env.EMAIL_FROM || 'noreply@tfila.fyotek.com';
  const fromName = 'אליעזר נכסים — פורטל סוכנים';

  // תבניות מיילים מוגדרות מראש
  let finalSubject = subject;
  let finalHtml = html;

  if (type === 'agent_approved') {
    finalSubject = 'הגישה שלך לפורטל אושרה';
    finalHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">ברוך הבא לפורטל סוכנים — אליעזר נכסים</h2>
        <p>שלום ${data.name || ''},</p>
        <p>המנהל אישר את הגישה שלך למערכת. כעת תוכל להיכנס ולהתחיל לעבוד.</p>
        <a href="${process.env.SITE_URL || 'https://tfila.fyotek.com'}/login"
           style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          כניסה למערכת
        </a>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">אליעזר נכסים • 25 שנות נדל"ן בבית שמש</p>
      </div>`;
  } else if (type === 'expense_approved') {
    finalSubject = `ההוצאה "${data.vendor}" אושרה`;
    finalHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">ההוצאה אושרה ✓</h2>
        <p>שלום ${data.agentName || ''},</p>
        <p>ההוצאה <strong>${data.vendor}</strong> בסך <strong>${data.amount}</strong> אושרה על ידי המנהל.</p>
        <a href="${process.env.SITE_URL || 'https://tfila.fyotek.com'}/expenses"
           style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          צפה בהוצאות
        </a>
      </div>`;
  } else if (type === 'expense_rejected') {
    finalSubject = `ההוצאה "${data.vendor}" נדחתה`;
    finalHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">ההוצאה נדחתה</h2>
        <p>שלום ${data.agentName || ''},</p>
        <p>ההוצאה <strong>${data.vendor}</strong> בסך <strong>${data.amount}</strong> נדחתה.</p>
        ${data.reason ? `<p><strong>סיבה:</strong> ${data.reason}</p>` : ''}
        <a href="${process.env.SITE_URL || 'https://tfila.fyotek.com'}/expenses"
           style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          צפה בהוצאות
        </a>
      </div>`;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject: finalSubject,
        html: finalHtml,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
