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

const VAT_RATE = 0.17;
const SIDES = ['קונה', 'מוכר', 'שני הצדדים'];
const ORIGINS = ['משרד', 'לבד'];

function getAreas() {
  try { return JSON.parse(localStorage.getItem('app_areas') || '["תל אביב","ירושלים","חיפה","הרצליה","רמת גן","פתח תקווה","ראשון לציון","נתניה"]'); } catch { return []; }
}

// חישוב VAT מסכום כולל
function calcVat(totalInclVat) {
  const total = parseFloat(totalInclVat) || 0;
  const beforeVat = parseFloat((total / (1 + VAT_RATE)).toFixed(2));
  const vat = parseFloat((total - beforeVat).toFixed(2));
  return { total, beforeVat, vat };
}

// חישוב עמלה
function calcCommission(total, commissionPct, commissionIncludesVat) {
  const pct = parseFloat(commissionPct) || 0;
  if (commissionIncludesVat) {
    // הסכום כולל מע"מ — מחשב לפני מע"מ ומע"מ
    const commTotal = parseFloat(((total * pct) / 100).toFixed(2));
    const commBeforeVat = parseFloat((commTotal / (1 + VAT_RATE)).toFixed(2));
    const commVat = parseFloat((commTotal - commBeforeVat).toFixed(2));
    return { commTotal, commBeforeVat, commVat };
  } else {
    // אחוז על הסכום לפני מע"מ
    const dealBeforeVat = parseFloat((total / (1 + VAT_RATE)).toFixed(2));
    const commBeforeVat = parseFloat(((dealBeforeVat * pct) / 100).toFixed(2));
    const commVat = parseFloat((commBeforeVat * VAT_RATE).toFixed(2));
    const commTotal = parseFloat((commBeforeVat + commVat).toFixed(2));
    return { commTotal, commBeforeVat, commVat };
  }
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
    agent_commission_percent: deal.agent_commission_percent || defaultAgent?.commission_percent || 50,
    client_name: deal.client_name || '',
    side: deal.side || '',
    address: deal.address || '',
    deal_amount: deal.deal_amount || '',          // כולל מע"מ
    commission_percent: deal.commission_percent || '',
    commission_includes_vat: deal.commission_includes_vat ?? true,
    has_invoice: deal.has_invoice || false,
    lead_source: deal.lead_source || '',
    origin: deal.origin || '',
    lawyer_name: deal.lawyer_name || '',
    cooperation_agent: deal.cooperation_agent || '',
    post_deal_procedure: deal.post_deal_procedure || '',
    notes: deal.notes || '',
    status: deal.status || 'פתוחה',
  });

  const queryClient = useQueryClient();

  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleAgentChange = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    setForm(prev => ({
      ...prev,
      agent_id: agentId,
      agent_name: agent?.name || '',
      agent_commission_percent: agent?.commission_percent || prev.agent_commission_percent,
    }));
  };

  // חישובים אוטומטיים
  const vatCalc = calcVat(form.deal_amount);
  const commCalc = calcCommission(vatCalc.total, form.commission_percent, form.commission_includes_vat);
  const agentPct = parseFloat(form.agent_commission_percent) || 0;
  const agentCommission = parseFloat(((commCalc.commTotal * agentPct) / 100).toFixed(2));
  const officeCommission = parseFloat((commCalc.commTotal - agentCommission).toFixed(2));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        deal_amount: vatCalc.total,
        amount_before_vat: vatCalc.beforeVat,
        vat_amount: vatCalc.vat,
        commission_amount: commCalc.commTotal,
        commission_before_vat: commCalc.commBeforeVat,
        vat_on_commission: commCalc.commVat,
        agent_commission: agentCommission,
        office_commission: officeCommission,
        agent_commission_percent: agentPct,
        commission_percent: parseFloat(form.commission_percent) || 0,
      };
      return isNew
        ? base44.entities.Deal.create(payload)
        : base44.entities.Deal.update(deal.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success(isNew ? 'העסקה נוצרה' : 'העסקה עודכנה');
      onClose();
    },
    onError: () => toast.error('שגיאה בשמירת העסקה'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'עסקה חדשה' : 'עריכת עסקה'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

          {/* פרטי עסקה בסיסיים */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">שם לקוח *</Label><Input value={form.client_name} onChange={e => upd('client_name', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">כתובת</Label><Input value={form.address} onChange={e => upd('address', e.target.value)} /></div>
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
            <div className="space-y-1"><Label className="text-xs">חודש</Label><Input type="month" value={form.month} onChange={e => upd('month', e.target.value)} /></div>
          </div>

          {/* סוכן */}
          {admin ? (
            <div className="space-y-1">
              <Label className="text-xs">סוכן</Label>
              <Select value={form.agent_id} onValueChange={handleAgentChange}>
                <SelectTrigger><SelectValue placeholder="בחר סוכן" /></SelectTrigger>
                <SelectContent>{agents.filter(a => a.is_active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div className="p-3 bg-muted rounded-xl text-sm">סוכן: <strong>{form.agent_name}</strong></div>
          )}

          {/* סכום עסקה + VAT */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">סכום עסקה כולל מע״מ *</Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input type="number" value={form.deal_amount} onChange={e => upd('deal_amount', e.target.value)} className="pr-7" placeholder="0" />
              </div>
            </div>
            {vatCalc.total > 0 && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-xl text-xs">
                <div><p className="text-muted-foreground">לפני מע״מ</p><p className="font-semibold">{formatCurrency(vatCalc.beforeVat)}</p></div>
                <div><p className="text-muted-foreground">מע״מ (17%)</p><p className="font-semibold">{formatCurrency(vatCalc.vat)}</p></div>
                <div><p className="text-muted-foreground">כולל מע״מ</p><p className="font-semibold">{formatCurrency(vatCalc.total)}</p></div>
              </div>
            )}
          </div>

          {/* עמלה */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">אחוז עמלה (%)</Label>
                <Input type="number" value={form.commission_percent} onChange={e => upd('commission_percent', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">עמלה כוללת מע״מ?</Label>
                <Select value={String(form.commission_includes_vat)} onValueChange={v => upd('commission_includes_vat', v === 'true')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">כולל מע״מ</SelectItem>
                    <SelectItem value="false">לא כולל מע״מ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {commCalc.commTotal > 0 && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-blue-50 rounded-xl text-xs">
                <div><p className="text-muted-foreground">עמלה לפני מע״מ</p><p className="font-semibold">{formatCurrency(commCalc.commBeforeVat)}</p></div>
                <div><p className="text-muted-foreground">מע״מ על עמלה</p><p className="font-semibold">{formatCurrency(commCalc.commVat)}</p></div>
                <div><p className="text-muted-foreground">עמלה סופית</p><p className="font-bold text-blue-700">{formatCurrency(commCalc.commTotal)}</p></div>
              </div>
            )}
          </div>

          {/* חלוקת עמלה */}
          {commCalc.commTotal > 0 && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-purple-50 rounded-xl text-xs">
              <div>
                <p className="text-muted-foreground">אחוז סוכן</p>
                {admin ? (
                  <Input type="number" value={form.agent_commission_percent}
                    onChange={e => upd('agent_commission_percent', e.target.value)}
                    className="h-7 text-xs mt-1" />
                ) : (
                  <p className="font-bold">{agentPct}%</p>
                )}
              </div>
              <div><p className="text-muted-foreground">עמלת סוכן</p><p className="font-bold text-emerald-700">{formatCurrency(agentCommission)}</p></div>
              <div><p className="text-muted-foreground">עמלת משרד</p><p className="font-bold text-primary">{formatCurrency(officeCommission)}</p></div>
            </div>
          )}

          {/* שדות אדמין */}
          {admin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">סטטוס</Label>
                  <Select value={form.status} onValueChange={v => upd('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['פתוחה','ממתין לגבייה','נגבה חלקית','נגבה מלא','שולם לסוכן','סגורה','בוטלה'].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">מקור ליד</Label>
                  <Input value={form.lead_source} onChange={e => upd('lead_source', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">שם עו״ד</Label><Input value={form.lawyer_name} onChange={e => upd('lawyer_name', e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">סוכן שיתוף</Label><Input value={form.cooperation_agent} onChange={e => upd('cooperation_agent', e.target.value)} /></div>
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
            </>
          )}

          {!admin && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">מקור ליד</Label><Input value={form.lead_source} onChange={e => upd('lead_source', e.target.value)} /></div>
            </div>
          )}

          <div className="space-y-1"><Label className="text-xs">הערות</Label><Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} /></div>

          <Button className="w-full rounded-xl gap-2" onClick={() => mutation.mutate()} disabled={!form.client_name || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'צור עסקה' : 'שמור שינויים'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
