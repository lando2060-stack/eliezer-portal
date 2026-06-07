/**
 * POST /api/google/disconnect
 * Removes Google integration for the authenticated user only.
 * Requires: Authorization: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

  await supabase.from('google_integrations').delete().eq('user_id', user.id);
  return res.status(200).json({ success: true });
}
