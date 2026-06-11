import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const DEFAULTS = {
  can_add_deal: true,
  can_add_expense: true,
  can_add_income: true,
  can_upload_drive: true,
  can_connect_email: true,
};

export function useAgentPermissions() {
  const { data } = useQuery({
    queryKey: ['my-agent-permissions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return DEFAULTS;
      const { data: agent } = await supabase
        .from('agents')
        .select('permissions')
        .eq('user_id', user.id)
        .maybeSingle();
      return { ...DEFAULTS, ...(agent?.permissions || {}) };
    },
    staleTime: 60000,
  });
  return data || DEFAULTS;
}
