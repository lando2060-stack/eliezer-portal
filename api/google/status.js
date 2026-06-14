/**
 * GET /api/google/status?service=drive|gmail
 * Returns Google connection status for the authenticated user.
 * Requires: Authorization: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const service = req.query.service || 'drive';

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { data } = await supabase
    .from('google_integrations')
    .select('connected_email, drive_folder_id, created_at')
    .eq('user_id', user.id)
    .eq('service', service)
    .single();

  if (!data) {
    return res.status(200).json({ connected: false });
  }

  const response = {
    connected: true,
    email: data.connected_email,
    connectedAt: data.created_at,
  };
  if (data.drive_folder_id) {
    response.folderUrl = `https://drive.google.com/drive/folders/${data.drive_folder_id}`;
  }
  return res.status(200).json(response);
}
