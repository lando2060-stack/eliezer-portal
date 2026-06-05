/**
 * POST /api/google/disconnect
 * Removes Google Drive integration
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await supabase.from('google_integrations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  return res.status(200).json({ success: true });
}
