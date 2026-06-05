/**
 * GET /api/google/status
 * Returns current Google Drive connection status
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data } = await supabase
    .from('google_integrations')
    .select('connected_email, drive_folder_id, created_at')
    .limit(1)
    .single();

  if (!data) {
    return res.status(200).json({ connected: false });
  }

  const folderUrl = `https://drive.google.com/drive/folders/${data.drive_folder_id}`;
  return res.status(200).json({
    connected: true,
    email: data.connected_email,
    folderUrl,
    connectedAt: data.created_at,
  });
}
