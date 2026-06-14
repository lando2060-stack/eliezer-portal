import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  // isLoadingPublicSettings kept for App.jsx compatibility — always false
  const isLoadingPublicSettings = false;

  async function loadUserProfile(supabaseUser) {
    if (!supabaseUser) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, role, is_approved')
      .eq('id', supabaseUser.id)
      .single();
    setUser({
      id: supabaseUser.id,
      email: supabaseUser.email,
      full_name: profile?.full_name || supabaseUser.user_metadata?.full_name || '',
      phone: profile?.phone || '',
      role: profile?.role || 'agent',
      is_approved: profile?.is_approved ?? false,
    });
    setIsAuthenticated(true);
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserProfile(session?.user ?? null).finally(() => {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      });
    });

    // Listen for auth changes (login, logout, token refresh, password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await loadUserProfile(session?.user ?? null);
      if (!session) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } catch {
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/admin/dashboard';
  };

  const navigateToLogin = () => {
    window.location.href = '/admin/dashboard';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
