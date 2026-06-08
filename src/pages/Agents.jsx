import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, CheckCircle2, Clock, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/constants';

const EMPTY = { name: '', email: '', phone: '', commission_percent: 50, is_active: true, notes: '', user_id: '' };

function statusBadge(agent) {
  if (!agent.is_active) return <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">חסום</Badge>;
  return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">מאושר</Badge>;
}

export default function Agents() {
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const { data: allDeals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => base44.entities.Deal.list('-created_date', 500),
  });

  const agentStats = useMemo(() => {
    const map = {};
    for (const deal of allDeals) {
      if (!deal.agent_id) continue;
      if (!map[deal.agent_id]) map[deal.agent_id] = { count: 0, income: 0 };
      map[deal.agent_id].count++;
      map[deal.agent_id].income += deal.agent_commission || 0;
    }
    return map;
  }, [allDeals]);

  const { data: pendingProfiles = [], isLoading: loadingPending } = useQuery({
    queryKey: ['pending-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, is_approved')
        .eq('is_approved', false)
        .eq('role', 'agent');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => dialog.id
      ? base44.entities.Agent.update(dialog.id, form)
      : base44.entities.Agent.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(dialog.id ? 'הסוכן עודכן' : 'הסוכן נוסף');
      setDialog(null);
    },
    onError: () => toast.error('שגיאה בשמירת הסוכן'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agents'] }); toast.success('הסוכן נמחק'); },
    onError: () => toast.error('שגיאה במחיקת הסוכן'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Agent.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
    onError: () => toast.error('שגיאה בעדכון הסטטוס'),
  });

  const approveMutation = useMutation({
    mutationFn: async (profile) => {
      const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', profile.id);
      if (error) throw error;
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: profile.email, type: 'agent_approved', data: { name: profile.full_name } }),
        });
      } catch { /* non-fatal */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-profiles'] });
      toast.success('הסוכן אושר בהצלחה');
    },
    onError: () => toast.error('שגיאה באישור הסוכן'),
  });

  const openNew = () => { setForm(EMPTY); setDialog({}); };
  const openEdit = (a) => { setForm({ ...a }); setDialog(a); };
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isLoading = loadingAgents || loadingPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">סוכנים</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {agents.length} סוכנים
            {pendingProfiles.length > 0 && <span className="text-amber-600"> • {pendingProfiles.length} ממתינים לאישור</span>}
          </p>
        </div>
        <Button className="gap-2 rounded-xl" onClick={openNew}>
          <Plus className="w-4 h-4" /> סוכן חדש
        </Button>
      </div>

      {/* Pending profiles */}
      {pendingProfiles.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
            <Clock className="w-4 h-4" /> ממתינים לאישור ({pendingProfiles.length})
          </h2>
          {pendingProfiles.map(p => (
            <Card key={p.id} className="rounded-2xl border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <UserCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{p.full_name || 'ללא שם'}</p>
                    <p className="text-sm text-muted-foreground">{p.phone || ''}</p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">ממתין לאישור</Badge>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => approveMutation.mutate(p)}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4" /> אשר גישה
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Agents table */}
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">שם</TableHead>
              <TableHead className="text-right">טלפון</TableHead>
              <TableHead className="text-right">מייל</TableHead>
              <TableHead className="text-right">עמלה %</TableHead>
              <TableHead className="text-right">עסקאות</TableHead>
              <TableHead className="text-right">נכנס</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">פעיל</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : agents.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">אין סוכנים עדיין</TableCell></TableRow>
            ) : agents.map(agent => {
              const stats = agentStats[agent.id] || { count: 0, income: 0 };
              return (
              <TableRow key={agent.id} className="hover:bg-muted/30">
                <TableCell className="font-semibold">{agent.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{agent.phone || '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{agent.email || '-'}</TableCell>
                <TableCell className="font-medium">{agent.commission_percent || 0}%</TableCell>
                <TableCell className="font-medium text-blue-700">{stats.count}</TableCell>
                <TableCell className="font-medium text-emerald-700">{formatCurrency(stats.income)}</TableCell>
                <TableCell>{statusBadge(agent)}</TableCell>
                <TableCell>
                  <Switch
                    checked={agent.is_active}
                    onCheckedChange={v => toggleActive.mutate({ id: agent.id, is_active: v })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(agent)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (window.confirm(`למחוק את הסוכן "${agent.name}"?`)) deleteMutation.mutate(agent.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Edit/Add dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dialog?.id ? 'עריכת סוכן' : 'סוכן חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">שם סוכן *</Label><Input value={form.name} onChange={e => upd('name', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">טלפון</Label><Input value={form.phone} onChange={e => upd('phone', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">מייל</Label><Input type="email" value={form.email} onChange={e => upd('email', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">אחוז עמלה (%)</Label>
                <Input type="number" value={form.commission_percent} onChange={e => upd('commission_percent', parseFloat(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מזהה משתמש (user_id)</Label>
                <Input value={form.user_id} onChange={e => upd('user_id', e.target.value)} placeholder="אופציונלי" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => upd('is_active', v)} />
              <Label className="text-sm">סוכן פעיל</Label>
            </div>
            <div className="space-y-1"><Label className="text-xs">הערות</Label><Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} /></div>
            <Button className="w-full rounded-xl" onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {dialog?.id ? 'שמור שינויים' : 'הוסף סוכן'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
