import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';
import { isAdmin } from '@/lib/roles';

export default function ExpenseEditDialog({ expense, categories, agents = [], currentUser, myAgent, onClose }) {
  const isNew = !expense.id;
  const admin = isAdmin(currentUser);

  const [data, setData] = useState({
    vendor_name: expense.vendor_name || '',
    vendor_tax_id: expense.vendor_tax_id || '',
    date: expense.date || new Date().toISOString().split('T')[0],
    total_amount: expense.total_amount || '',
    amount_before_vat: expense.amount_before_vat || '',
    vat_amount: expense.vat_amount || '',
    category: expense.category || '',
    payment_method: expense.payment_method || '',
    receipt_number: expense.receipt_number || '',
    invoice_number: expense.invoice_number || '',
    currency: expense.currency || 'ILS',
    notes: expense.notes || '',
    has_receipt: expense.has_receipt || false,
    status: expense.status || (isNew ? 'approved' : expense.status),
    receipt_url: expense.receipt_url || '',
    scope: expense.scope || (admin ? 'office' : 'agent'),
    agent_id: expense.agent_id || (myAgent?.id || ''),
    agent_name: expense.agent_name || (myAgent?.name || ''),
    deal_id: expense.deal_id || '',
    document_type: expense.document_type || 'receipt',
  });

  const queryClient = useQueryClient();
  const upd = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const handleAgentChange = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    setData(prev => ({ ...prev, agent_id: agentId, agent_name: agent?.name || '' }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // If agent submitting office expense → pending_approval, agent expense → approved
      const status = !admin
        ? (data.scope === 'office' ? 'pending_approval' : 'approved')
        : data.status;
      const payload = {
        ...data,
        status,
        total_amount: parseFloat(data.total_amount) || 0,
        amount_before_vat: parseFloat(data.amount_before_vat) || 0,
        vat_amount: parseFloat(data.vat_amount) || 0,
        agent_id: data.agent_id || myAgent?.id || '',
        agent_name: data.agent_name || myAgent?.name || '',
      };
      return isNew ? base44.entities.Expense.create(payload) : base44.entities.Expense.update(expense.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(isNew ? 'ההוצאה נוצרה' : 'ההוצאה עודכנה');
      onClose();
    },
    onError: () => toast.error('שגיאה בשמירת ההוצאה'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'הוצאה חדשה' : 'עריכת הוצאה'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">שם ספק *</Label><Input value={data.vendor_name} onChange={e => upd('vendor_name', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">תאריך *</Label><Input type="date" value={data.date} onChange={e => upd('date', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">סכום כולל *</Label><Input type="number" value={data.total_amount} onChange={e => upd('total_amount', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">לפני מע״מ</Label><Input type="number" value={data.amount_before_vat} onChange={e => upd('amount_before_vat', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">מע״מ</Label><Input type="number" value={data.vat_amount} onChange={e => upd('vat_amount', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">קטגוריה</Label>
              <Select value={data.category} onValueChange={v => upd('category', v)}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אמצעי תשלום</Label>
              <Select value={data.payment_method} onValueChange={v => upd('payment_method', v)}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Scope / expense type */}
          <div className="space-y-1">
            <Label className="text-xs">סוג הוצאה</Label>
            <Select value={data.scope} onValueChange={v => upd('scope', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {!admin && <SelectItem value="agent">הוצאה פרטית שלי</SelectItem>}
                <SelectItem value="office">הוצאת משרד</SelectItem>
                {admin && <SelectItem value="agent">הוצאת סוכן</SelectItem>}
                <SelectItem value="deal">קשורה לעסקה</SelectItem>
              </SelectContent>
            </Select>
            {!admin && data.scope === 'office' && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">⏳ הוצאת משרד תועבר לאישור מנהל</p>
            )}
          </div>

          {data.scope === 'agent' && admin && (
            <div className="space-y-1">
              <Label className="text-xs">סוכן</Label>
              <Select value={data.agent_id} onValueChange={handleAgentChange}>
                <SelectTrigger><SelectValue placeholder="בחר סוכן" /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">מספר קבלה</Label><Input value={data.receipt_number} onChange={e => upd('receipt_number', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">מספר חשבונית</Label><Input value={data.invoice_number} onChange={e => upd('invoice_number', e.target.value)} /></div>
          </div>

          <div className="space-y-1"><Label className="text-xs">הערות</Label><Textarea value={data.notes} onChange={e => upd('notes', e.target.value)} rows={2} /></div>

          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !data.vendor_name || !data.total_amount} className="w-full rounded-xl gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'צור הוצאה' : 'שמור שינויים'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}