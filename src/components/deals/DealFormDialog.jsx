import React, { useState, useRef, useEffect } from 'react';
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
import { formatCurrency, computeDealStatus } from '@/lib/constants';

const SIDES = ['קונה', 'מוכר', 'שני הצדדים'];
const VAT_RATE = 0.18;

function getAreas() {
  try {
    return JSON.parse(localStorage.getItem('app_areas') || '["תל אביב","ירושלים","חיפה","הרצליה","רמת גן","פתח תקווה","ראשון לציון","נתניה"]');
  } catch { return []; }
}

function getLeadSources() {
  try {
    return JSON.parse(localStorage.getItem('app_lead_sources') || '["יד2","פייסבוק","המלצה","אתר","אינסטגרם"]');
  } catch { return []; }
}

function saveLeadSource(value) {
  if (!value?.trim()) return;
  const existing = getLeadSources();
  if (!existing.includes(value.trim())) {
    const updated = [...existing, value.trim()];
    localStorage.setItem('app_lead_sources', JSON.stringify(updated));
  }
}

// Autocomplete input for lead source
function LeadSourceInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (val) => {
    onChange(val);
    const sources = getLeadSources();
    setSuggestions(val ? sources.filter(s => s.includes(val) && s !== val) : sources);
    setOpen(true);
  };

  const handleFocus = () => {
    const sources = getLeadSources();
    setSuggestions(value ? sources.filter(s => s.includes(value) && s !== value) : sources);
    setOpen(true);
  };

  return (
    <div className="relative" ref={ref}>
      <Input
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={handleFocus}
        placeholder="הקלד או בחר מקור"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-background border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <button
              key={s}
              className="w-full text-right px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
    commission_percent: deal.commission_percent || 2,  // default 2%
    has_invoice: deal.has_invoice || false,
    lead_source: deal.lead_source || '',
    lawyer_name: deal.lawyer_name || '',
    cooperation_agent: deal.cooperation_agent || '',
    post_deal_procedure: deal.post_deal_procedure || '',
    notes: deal.notes || '',
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

  // Financial calculations
  const dealAmount = parseFloat(form.deal_amount) || 0;
  const commPct = parseFloat(form.commission_percent) || 2;
  const agentPct = parseFloat(form.agent_commission_percent) || 50;

  // Commission calculations (net — before VAT)
  const officeCommNet = Math.round(dealAmount * commPct / 100);     // עמלת משרד לפני מע"מ
  const agentCommNet = Math.round(officeCommNet * agentPct / 100);  // עמלת סוכן לפני מע"מ
  const officeCommNetAfterSplit = officeCommNet - agentCommNet;

  // With VAT (only when has_invoice)
  const commVat = form.has_invoice ? Math.round(officeCommNet * VAT_RATE) : 0;
  const officeCommWithVat = officeCommNet + commVat;

  const mutation = useMutation({
    mutationFn: () => {
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
        commission_percent: commPct,
        commission_amount: officeCommNet,
        agent_commission: agentCommNet,
        office_commission: officeCommNetAfterSplit,
        has_invoice: form.has_invoice,
        lead_source: form.lead_source,
        lawyer_name: form.lawyer_name,
        cooperation_agent: form.cooperation_agent,
        post_deal_procedure: form.post_deal_procedure,
        notes: form.notes,
        status: computeDealStatus({ commission_amount: officeCommNet, collected_actual: deal.collected_actual || 0 }),
      };
      return isNew
        ? base44.entities.Deal.create(payload)
        : base44.entities.Deal.update(deal.id, payload);
    },
    onSuccess: () => {
      if (form.lead_source) saveLeadSource(form.lead_source);
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

          {/* סכום עסקה + יש חשבונית */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">סכום עסקה *</Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input type="number" value={form.deal_amount} onChange={e => upd('deal_amount', e.target.value)} className="pr-7" placeholder="0" />
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch checked={form.has_invoice} onCheckedChange={v => upd('has_invoice', v)} id="has-invoice" />
              <Label htmlFor="has-invoice" className="text-sm font-medium cursor-pointer whitespace-nowrap">יש חשבונית</Label>
            </div>
          </div>

          {/* שורת עמלה */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">אחוז עמלה (%)</Label>
              <Input type="number" value={form.commission_percent} onChange={e => upd('commission_percent', e.target.value)} placeholder="2" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">סה״כ עמלה</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/40 text-sm font-medium flex items-center">
                {formatCurrency(officeCommNet)}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מע״מ</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/40 text-sm font-medium flex items-center">
                {form.has_invoice ? formatCurrency(commVat) : '—'}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">סה״כ כולל מע״מ</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/40 text-sm font-medium flex items-center">
                {form.has_invoice ? formatCurrency(officeCommWithVat) : '—'}
              </div>
            </div>
          </div>

          {/* שורת עמלת סוכן */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">אחוז עמלת סוכן (%)</Label>
              <Input type="number" value={form.agent_commission_percent} onChange={e => upd('agent_commission_percent', e.target.value)} placeholder="50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">עמלת סוכן</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/40 text-sm font-medium text-emerald-700 flex items-center">
                {formatCurrency(agentCommNet)}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">עמלת משרד</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted/40 text-sm font-medium text-primary flex items-center">
                {formatCurrency(officeCommNetAfterSplit)}
              </div>
            </div>
          </div>

          {/* שדות נוספים */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">מקור ליד</Label>
              <LeadSourceInput value={form.lead_source} onChange={v => upd('lead_source', v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">שם עו"ד</Label>
              <Input value={form.lawyer_name} onChange={e => upd('lawyer_name', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">סוכן שיתוף</Label>
              <Input value={form.cooperation_agent} onChange={e => upd('cooperation_agent', e.target.value)} />
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
