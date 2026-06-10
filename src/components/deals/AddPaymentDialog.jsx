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
import { formatCurrency } from '@/lib/constants';

const PAYMENT_METHODS = ['מזומן', 'שיק', 'העברה בנקאית', 'כרטיס אשראי', 'ביט', 'פייפאל', 'אחר'];

export default function AddPaymentDialog({ deal, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    amount: '',
    date: today,
    payment_method: '',
    notes: '',
  });
  const queryClient = useQueryClient();
  const upd = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const amount = parseFloat(form.amount) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Payment.create({
        amount,
        date: form.date,
        payment_method: form.payment_method,
        notes: form.notes,
        deal_id: deal.id,
        deal_client_name: deal.client_name,
        deal_address: deal.address || '',
        agent_id: deal.agent_id || '',
        agent_name: deal.agent_name || '',
      });
      const allPayments = await base44.entities.Payment.filter({ deal_id: deal.id });
      const newCollected = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
      await base44.entities.Deal.update(deal.id, { collected_actual: newCollected });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', deal.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('ההכנסה נוספה בהצלחה');
      onClose();
    },
    onError: () => toast.error('שגיאה בשמירת ההכנסה'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>הוספת הכנסה — {deal.client_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">סכום שהתקבל ₪ *</Label>
            <Input type="number" value={form.amount} onChange={e => upd('amount', e.target.value)} placeholder="0" />
            {amount > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(amount)}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">תאריך קבלה</Label>
            <Input type="date" value={form.date} onChange={e => upd('date', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">אמצעי תשלום</Label>
            <Select value={form.payment_method} onValueChange={v => upd('payment_method', v)}>
              <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} />
          </div>
          <Button className="w-full rounded-xl gap-2" onClick={() => mutation.mutate()}
            disabled={!form.amount || !form.date || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור הכנסה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
