import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = { name: '', email: '', phone: '', commission_percent: 50, is_active: true, notes: '', user_id: '' };

export default function Agents() {
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const saveMutation = useMutation({
    mutationFn: () => dialog.id
      ? base44.entities.Agent.update(dialog.id, form)
      : base44.entities.Agent.create(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agents'] }); toast.success(dialog.id ? 'הסוכן עודכן' : 'הסוכן נוסף'); setDialog(null); },
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

  const openNew = () => { setForm(EMPTY); setDialog({}); };
  const openEdit = (a) => { setForm({ ...a }); setDialog(a); };
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">סוכנים</h1>
          <p className="text-muted-foreground text-sm mt-1">{agents.length} סוכנים רשומים</p>
        </div>
        <Button className="gap-2 rounded-xl" onClick={openNew}>
          <Plus className="w-4 h-4" /> סוכן חדש
        </Button>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">שם</TableHead>
              <TableHead className="text-right">טלפון</TableHead>
              <TableHead className="text-right">מייל</TableHead>
              <TableHead className="text-right">עמלה %</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : agents.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">אין סוכנים עדיין</TableCell></TableRow>
            ) : agents.map(agent => (
              <TableRow key={agent.id} className="hover:bg-muted/30">
                <TableCell className="font-semibold">{agent.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{agent.phone || '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{agent.email || '-'}</TableCell>
                <TableCell className="font-medium">{agent.commission_percent || 0}%</TableCell>
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
                      onClick={() => { if (window.confirm(`למחוק את הסוכן "${agent.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteMutation.mutate(agent.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
