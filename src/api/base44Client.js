/**
 * Supabase compatibility shim — exposes the same API surface as the Base44 SDK
 * so all existing components work unchanged.
 */
import { supabase } from '@/lib/supabase';
import { createEntityApi } from './entityApi';

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, phone, role')
    .eq('id', userId)
    .single();
  return data;
}

const authApi = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');
    const profile = await getProfile(user.id);
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      phone: profile?.phone || '',
      role: profile?.role || 'agent',
    };
  },

  async loginViaEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async register({ email, password }) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });
    if (error) throw error;
    return data.session ? { access_token: data.session.access_token } : {};
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  loginWithProvider(provider, redirectTo = '/') {
    const redirectUrl = `${window.location.origin}${redirectTo}`;
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl } });
  },

  async logout(redirectPath = '/login') {
    await supabase.auth.signOut();
    window.location.href = redirectPath;
  },

  redirectToLogin(redirectUrl = window.location.href) {
    window.location.href = `/login?from=${encodeURIComponent(redirectUrl)}`;
  },

  async updateMe(updates) {
    if (updates.password) {
      const { error } = await supabase.auth.updateUser({ password: updates.password });
      if (error) throw error;
    }
    if (updates.phone !== undefined || updates.full_name !== undefined) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const patch = {};
      if (updates.phone !== undefined) patch.phone = updates.phone;
      if (updates.full_name !== undefined) patch.full_name = updates.full_name;
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
      // Sync to agents table if this user has a linked agent record
      const agentPatch = {};
      if (updates.full_name !== undefined) agentPatch.name = updates.full_name;
      if (updates.phone !== undefined) agentPatch.phone = updates.phone;
      await supabase.from('agents').update(agentPatch).eq('user_id', user.id);
    }
  },

  // Kept for password-change verification: sign-in verifies the current password
  async loginViaEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  // no-op: Supabase manages tokens via cookies/localStorage automatically
  setToken() {},

  async resetPasswordRequest(email) {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  // Called from ResetPassword page after Supabase recovery session is active
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
};

// ── File storage ──────────────────────────────────────────────────────────────

const BUCKET = 'receipts';

async function uploadFile({ file }) {
  const ext = file.name.split('.').pop().toLowerCase();
  const mimeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const contentType = file.type || mimeMap[ext] || 'application/octet-stream';
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { file_url: data.publicUrl };
}

// ── AI helpers (call Vercel serverless functions) ─────────────────────────────

async function extractDataFromUploadedFile({ file_url, json_schema }) {
  const res = await fetch('/api/extract-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url, json_schema }),
  });
  if (!res.ok) throw new Error('AI extraction failed');
  return res.json(); // { status: 'success', output: {...} }
}

async function invokeLLM({ prompt }) {
  const res = await fetch('/api/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error('LLM call failed');
  const data = await res.json();
  return data.result; // string
}

// ── User management ───────────────────────────────────────────────────────────

const usersApi = {
  async inviteUser(email, role) {
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invite failed');
    }
    return res.json();
  },
};

// ── Public export ─────────────────────────────────────────────────────────────

export const base44 = {
  entities: {
    Deal: createEntityApi('deals'),
    Expense: createEntityApi('expenses'),
    Agent: createEntityApi('agents'),
    Category: createEntityApi('categories'),
    Vendor: createEntityApi('vendors'),
    Payment: createEntityApi('payments'),
    RecurringExpense: createEntityApi('recurring_expenses'),
    ActivityLog: createEntityApi('activity_logs'),
    Document: createEntityApi('documents'),
    Client: createEntityApi('clients'),
    Project: createEntityApi('projects'),
  },
  auth: authApi,
  integrations: {
    Core: {
      UploadFile: uploadFile,
      ExtractDataFromUploadedFile: extractDataFromUploadedFile,
      InvokeLLM: invokeLLM,
    },
  },
  users: usersApi,
};
