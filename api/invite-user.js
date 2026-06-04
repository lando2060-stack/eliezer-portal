/**
 * Vercel serverless function — invites a user via Supabase Admin API.
 * Requires SUPABASE_SERVICE_ROLE_KEY (server-side only, never exposed to client).
 * POST /api/invite-user
 * Body: { email: string, role: 'admin' | 'agent' }
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, role = 'agent' } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase admin credentials not configured' });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role },
      redirectTo: `${process.env.SITE_URL || ''}/login`,
    });
    if (error) throw error;

    // Pre-create profile row with the requested role
    if (data.user) {
      await adminClient.from('profiles').upsert({
        id: data.user.id,
        role,
        full_name: '',
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('invite-user error:', err);
    return res.status(400).json({ error: err.message || 'Invite failed' });
  }
}
