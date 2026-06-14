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
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/constants';

const EMPTY = { name: '', email: '', phone: '', commission_percent: 50, is_active: true, notes: '', user_id: '' };

function statusBadge(agent) {
  if (!agent.is_active) return <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">חסום</Badge>;
  return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">פעיל</Badge>;
}

export default function Agents() {
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const { data: allDeals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => base44.entities.Deal.list('-created_date', 500),
  });

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.phone?.includes(q)
    );
  }, [agents, search]);

  const agentStats = useMemo(() => {
    const map = {};
    for (const deal of allDeals) {
      if (!deal.agent_id) continue;
      if (!map[deal.agent_id]) map[deal.agent_id] = { count: 0, agentIncome: 0, officeIncome: 0 };
      map[deal.agent_id].count++;
      map[deal.agent_id].agentIncome += deal.agent_commission || 0;
      map[deal.agent_id].officeIncome += deal.office_commission || 0;
    }
    return map;
  }, [allDeals]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.id) return base44.entities.Agent.update(dialog.id, form);
      const dup = agents.find(a => a.email?.toLowerCase() === form.email.toLowerCase());
      if (dup) throw new Error(`כבר קיים סוכן עם מייל זה: ${dup.name}`);
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, role: 'agent' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'שגיאה בשליחת הזמנה');
      // Auto-approve the new agent profile
      if (result.userId) {
        await supabase.from('profiles').update({ is_approved: true }).eq('id', result.userId);
      }
      return base44.entities.Agent.create({ ...form, user_id: result.userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(dialog.id ? 'הסוכן עודכן' : 'הסוכן נוסף — הזמנה נשלחה למייל');
      setDialog(null);
    },
    onError: (err) => toast.error(err.message || 'שגיאה בשמירת הסוכן'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agents'] }); toast.success('הסוכן נמחק'); },
    onError: () => toast.error('שגיאה במחיקת הסוכן'),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active, user_id }) => {
      await base44.entities.Agent.update(id, { is_active });
      if (user_id) {
        const { error } = await supabase.from('profiles').update({ is_approved: is_active }).eq('id', user_id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
    onError: () => toast.error('שגיאה בעדכון הסטטוס'),
  });

  const openNew = () => { setForm(EMPTY); setDialog({}); };
  const openEdit = (a) => { setForm({ ...a }); setDialog(a); };
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">סוכנים</h1>
          <p className="text-muted-foreground text-sm mt-1">{agents.length} סוכנים</p>
        </div>
        <Button className="gap-2 rounded-xl" onClick={openNew}>
          <Plus className="w-4 h-4" /> סוכן חדש
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="חיפוש לפי שם, מייל או טלפון..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9 rounded-xl"
        />
      </div>

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
              <TableHead className="text-right">עמלת סוכן</TableHead>
              <TableHead className="text-right">עמלת משרד</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">פעיל</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : filteredAgents.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">{search ? 'לא נמצאו סוכנים התואמים לחיפוש' : 'אין סוכנים עדיין'}</TableCell></TableRow>
            ) : filteredAgents.map(agent => {
              const stats = agentStats[agent.id] || { count: 0, agentIncome: 0, officeIncome: 0 };
              return (
                <TableRow key={agent.id} className="hover:bg-muted/30">
                  <TableCell className="font-semibold">{agent.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{agent.phone || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{agent.email || '-'}</TableCell>
                  <TableCell className="font-medium">{agent.commission_percent || 0}%</TableCell>
                  <TableCell className="font-medium text-blue-700">{stats.count}</TableCell>
                  <TableCell className="font-medium text-emerald-700">{formatCurrency(stats.agentIncome)}</TableCell>
                  <TableCell className="font-medium text-primary">{formatCurrency(stats.officeIncome)}</TableCell>
                  <TableCell>{statusBadge(agent)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={agent.is_active}
                      onCheckedChange={v => toggleActive.mutate({ id: agent.id, is_active: v, user_id: agent.user_id })}
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
            <div className="space-y-1">
              <Label className="text-xs">מייל {!dialog?.id && <span className="text-destructive">*</span>}</Label>
              <Input type="email" value={form.email} onChange={e => upd('email', e.target.value)} disabled={!!dialog?.id} />
              {!dialog?.id && <p className="text-xs text-muted-foreground">הזמנה תישלח אוטומטית לכתובת זו</p>}
            </div>
            <div className="space-y-1"><Label className="text-xs">טלפון</Label><Input value={form.phone} onChange={e => upd('phone', e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">אחוז עמלה (%)</Label>
              <Input type="number" value={form.commission_percent} onChange={e => upd('commission_percent', parseFloat(e.target.value))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => upd('is_active', v)} />
              <Label className="text-sm">סוכן פעיל</Label>
            </div>
            <div className="space-y-1"><Label className="text-xs">הערות</Label><Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} /></div>
            <Button className="w-full rounded-xl" onClick={() => saveMutation.mutate()} disabled={!form.name || (!dialog?.id && !form.email) || saveMutation.isPending}>
              {dialog?.id ? 'שמור שינויים' : 'הוסף סוכן'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
