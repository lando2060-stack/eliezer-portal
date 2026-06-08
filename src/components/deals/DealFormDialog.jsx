import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { isAdmin } from '@/lib/roles';
import { formatCurrency } from '@/lib/constants';

const SIDES = ['קונה', 'מוכר', 'שני הצדדים'];
const ORIGINS = ['משרד', 'לבד'];
const STATUSES = ['פתוחה', 'ממתין לגבייה', 'נגבה חלקית', 'נגבה מלא', 'שולם לסוכן', 'סגורה', 'בוטלה'];

function getAreas() {
  try {
    return JSON.parse(localStorage.getItem('app_areas') || '["תל אביב","ירושלים","חיפה","הרצליה","רמת גן","פתח תקווה","ראשון לציון","נתניה"]');
  } catch { return []; }
}

export default function DealFormDialog({ deal, agents, currentUser, myAgent, onClose }) {
  const isNew = !deal.id;
  const admin = isAdmin(currentUser);
  const areas = getAreas();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultAgent = admin ? null : myAgent;

  const [form, setForm] = useState({
    month: deal.month || defaultMonth,
    area: deal.area || '',
    agent_id: deal.agent_id || defaultAgent?.id || '',
    agent_name: deal.agent_name || defaultAgent?.name || '',
    agent_commission_percent: deal.agent_commission_percent ?? defaultAgent?.commission_percent ?? 50,
    client_name: deal.client_name || '',
    side: deal.side || '',
    address: deal.address || '',
    deal_amount: deal.deal_amount || '',
    commission_percent: deal.commission_percent || '',
    has_invoice: deal.has_invoice || false,
    lead_source: deal.lead_source || '',
    origin: deal.origin || '',
    lawyer_name: deal.lawyer_name || '',
    cooperation_agent: deal.cooperation_agent || '',
    post_deal_procedure: deal.post_deal_procedure || '',
    notes: deal.notes || '',
    status: deal.status || 'פתוחה',
    commission_amount: deal.commission_amount || 0,
    agent_commission: deal.agent_commission || 0,
    office_commission: deal.office_commission || 0,
  });

  const queryClient = useQueryClient();
  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleAgentChange = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    setForm(prev => ({
      ...prev,
      agent_id: agentId,
      agent_name: agent?.name || '',
      agent_commission_percent: agent?.commission_percent ?? prev.agent_commission_percent,
    }));
  };

  // חישובים
  const dealAmount = parseFloat(form.deal_amount) || 0;
  const commPct = parseFloat(form.commission_percent) || 0;
  const commAmount = parseFloat(((dealAmount * commPct) / 100).toFixed(2));
  const agentPct = parseFloat(form.agent_commission_percent) || 0;
  const agentComm = parseFloat(((commAmount * agentPct) / 100).toFixed(2));
  const officeComm = parseFloat((commAmount - agentComm).toFixed(2));

  const mutation = useMutation({
    mutationFn: () => {
      // Only include columns that exist in the deals table
      const payload = {
        month: form.month,
        area: form.area,
        agent_id: form.agent_id || '',
        agent_name: form.agent_name || '',
        agent_commission_percent: agentPct,
        client_name: form.client_name,
        side: form.side,
        address: form.address,
        deal_amount: dealAmount,
        commission_amount: commAmount,
        agent_commission: agentComm,
        office_commission: officeComm,
        has_invoice: form.has_invoice,
        lead_source: form.lead_source,
        origin: form.origin,
        lawyer_name: form.lawyer_name,
        cooperation_agent: form.cooperation_agent,
        post_deal_procedure: form.post_deal_procedure,
        notes: form.notes,
        status: form.status,
      };
      return isNew
        ? base44.entities.Deal.create(payload)
        : base44.entities.Deal.update(deal.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success(isNew ? 'העסקה נוצרה בהצלחה' : 'העסקה עודכנה בהצלחה');
      onClose();
    },
    onError: (err) => {
      console.error('Deal save error:', err);
      toast.error(`שגיאה בשמירת העסקה: ${err?.message || 'נסה שוב'}`);
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'עסקה חדשה' : 'עריכת עסקה'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

          {/* פרטי לקוח */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">שם לקוח *</Label>
              <Input value={form.client_name} onChange={e => upd('client_name', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">כתובת</Label>
              <Input value={form.address} onChange={e => upd('address', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">צד</Label>
              <Select value={form.side} onValueChange={v => upd('side', v)}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אזור</Label>
              <Select value={form.area} onValueChange={v => upd('area', v)}>
                <SelectTrigger><SelectValue placeholder="בחר אזור" /></SelectTrigger>
                <SelectContent>{areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">חודש</Label>
              <Input type="month" value={form.month} onChange={e => upd('month', e.target.value)} />
            </div>
          </div>

          {/* סוכן */}
          {admin ? (
            <div className="space-y-1">
              <Label className="text-xs">סוכן</Label>
              <Select value={form.agent_id} onValueChange={handleAgentChange}>
                <SelectTrigger><SelectValue placeholder="בחר סוכן" /></SelectTrigger>
                <SelectContent>
                  {agents.filter(a => a.is_active).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="p-3 bg-muted rounded-xl text-sm">סוכן: <strong>{form.agent_name || 'לא מוגדר'}</strong></div>
          )}

          {/* סכום עסקה */}
          <div className="space-y-1">
            <Label className="text-xs">סכום עסקה *</Label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
              <Input type="number" value={form.deal_amount} onChange={e => upd('deal_amount', e.target.value)} className="pr-7" placeholder="0" />
            </div>
          </div>

          {/* עמלה */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">אחוז עמלה (%)</Label>
              <Input type="number" value={form.commission_percent} onChange={e => upd('commission_percent', e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אחוז סוכן (%)</Label>
              <Input type="number" value={form.agent_commission_percent} onChange={e => upd('agent_commission_percent', e.target.value)} placeholder="50" />
            </div>
          </div>

          {/* חלוקת עמלה */}
          {commAmount > 0 && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-blue-50 rounded-xl text-xs">
              <div><p className="text-muted-foreground">עמלה סופית</p><p className="font-bold text-blue-700">{formatCurrency(commAmount)}</p></div>
              <div><p className="text-muted-foreground">עמלת סוכן</p><p className="font-bold text-emerald-700">{formatCurrency(agentComm)}</p></div>
              <div><p className="text-muted-foreground">עמלת משרד</p><p className="font-bold text-primary">{formatCurrency(officeComm)}</p></div>
            </div>
          )}

          {/* שדות מלאים — כולל לסוכן */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">סטטוס</Label>
              <Select value={form.status} onValueChange={v => upd('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מקור ליד</Label>
              <Input value={form.lead_source} onChange={e => upd('lead_source', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">שם עו"ד</Label>
              <Input value={form.lawyer_name} onChange={e => upd('lawyer_name', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">סוכן שיתוף</Label>
              <Input value={form.cooperation_agent} onChange={e => upd('cooperation_agent', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">משרד או לבד</Label>
              <Select value={form.origin} onValueChange={v => upd('origin', v)}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{ORIGINS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={form.has_invoice} onCheckedChange={v => upd('has_invoice', v)} />
              <Label className="text-sm">יש חשבונית</Label>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} />
          </div>

          <Button
            className="w-full rounded-xl gap-2"
            onClick={() => mutation.mutate()}
            disabled={!form.client_name || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'צור עסקה' : 'שמור שינויים'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
