/**
 * Shared receipt upload → AI extract → review dialog.
 *
 * Modes:
 *   1. Upload mode (default): shows file-picker, uploads to Supabase, extracts, shows review
 *   2. Extract mode: given an existing receiptUrl, goes straight to extraction then review
 *
 * Props:
 *   open            boolean
 *   onClose         () => void
 *   onSaved         () => void  (called after expense is saved)
 *   receiptUrl      string?     if provided, skip upload and go straight to extract
 *   expenseId       string?     if provided, update this expense instead of creating new one
 *   agents          array       for admin agent assignment
 *   categories      array
 *   isAdminView     boolean
 */
import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Camera, FileText, Loader2, CheckCircle2, X, RotateCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    vendor_name:      { type: 'string',  description: 'Business/vendor name' },
    vendor_tax_id:    { type: 'string',  description: 'Tax ID / business number' },
    date:             { type: 'string',  description: 'Date in YYYY-MM-DD format' },
    receipt_number:   { type: 'string',  description: 'Receipt number' },
    invoice_number:   { type: 'string',  description: 'Invoice number' },
    total_amount:     { type: 'number',  description: 'Total amount including VAT' },
    amount_before_vat:{ type: 'number',  description: 'Amount before VAT' },
    vat_amount:       { type: 'number',  description: 'VAT amount' },
    payment_method:   { type: 'string',  description: 'Payment method' },
    currency:         { type: 'string',  description: 'Currency code: ILS, USD, EUR, GBP' },
    vendor_address:   { type: 'string',  description: 'Business address' },
    vendor_phone:     { type: 'string',  description: 'Business phone' },
  },
};

export default function ReceiptReviewDialog({
  open,
  onClose,
  onSaved,
  receiptUrl: initialReceiptUrl,
  expenseId,
  isAdminView = false,
}) {
  const [step, setStep] = useState('upload'); // upload | processing | review
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [extractedData, setExtractedData] = useState({});
  const [rotation, setRotation] = useState(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list(), enabled: isAdminView });

  // If receiptUrl is provided, skip straight to extraction on open
  useEffect(() => {
    if (open && initialReceiptUrl) {
      setFileUrl(initialReceiptUrl);
      setPreviewUrl(initialReceiptUrl);
      runExtraction(initialReceiptUrl);
    }
  }, [open, initialReceiptUrl]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setFileUrl('');
      setPreviewUrl('');
      setExtractedData({});
      setRotation(0);
    }
  }, [open]);

  const runExtraction = async (url) => {
    setStep('processing');
    try {
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: url,
        json_schema: EXTRACT_SCHEMA,
      });

      let suggestedCategory = '';
      if (result?.status === 'success' && result.output?.vendor_name && categories.length > 0) {
        try {
          const catResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Given this vendor name: "${result.output.vendor_name}", suggest the most appropriate expense category from this list: ${categories.map(c => c.name).join(', ')}. Return ONLY the category name, nothing else.`,
          });
          suggestedCategory = catResult?.trim() || '';
        } catch { /* non-fatal */ }
      }

      if (result?.status === 'success' && result.output) {
        setExtractedData({
          ...result.output,
          category: suggestedCategory || '',
          receipt_url: url,
          has_receipt: true,
          status: 'pending_approval',
        });
      } else {
        toast.error('לא הצלחנו לחלץ נתונים — ניתן להזין ידנית');
        setExtractedData({ receipt_url: url, has_receipt: true, status: 'pending_approval' });
      }
    } catch {
      toast.error('שגיאה בסריקת הקבלה — ניתן להזין פרטים ידנית');
      setExtractedData({ receipt_url: url, has_receipt: true, status: 'pending_approval' });
    }
    setStep('review');
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setStep('processing');

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setFileUrl(file_url);
      await runExtraction(file_url);
    } catch {
      toast.error('שגיאה בהעלאת הקובץ — אנא נסה שוב');
      setStep('upload');
      setFile(null);
      setPreviewUrl('');
    }
  };

  const upd = (field, value) => setExtractedData(prev => ({ ...prev, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        vendor_name:      data.vendor_name || '',
        vendor_tax_id:    data.vendor_tax_id || '',
        date:             data.date || '',
        receipt_number:   data.receipt_number || '',
        invoice_number:   data.invoice_number || '',
        total_amount:     parseFloat(data.total_amount) || 0,
        amount_before_vat:parseFloat(data.amount_before_vat) || 0,
        vat_amount:       parseFloat(data.vat_amount) || 0,
        payment_method:   data.payment_method || '',
        currency:         data.currency || 'ILS',
        category:         data.category || '',
        notes:            data.notes || '',
        receipt_url:      data.receipt_url || '',
        has_receipt:      !!data.receipt_url,
        status:           'pending_approval',
        agent_id:         data.agent_id || '',
        agent_name:       data.agent_name || '',
        vendor_address:   data.vendor_address || '',
        vendor_phone:     data.vendor_phone || '',
      };

      let expense;
      if (expenseId) {
        expense = await base44.entities.Expense.update(expenseId, payload);
      } else {
        // Duplicate check
        if (payload.vendor_name && payload.total_amount && payload.date) {
          const existing = await base44.entities.Expense.filter({
            vendor_name: payload.vendor_name,
            total_amount: payload.total_amount,
            date: payload.date,
          });
          if (existing.length > 0) {
            const ok = window.confirm('נראה שקבלה דומה כבר קיימת. להמשיך בשמירה?');
            if (!ok) throw new Error('cancelled');
          }
        }
        expense = await base44.entities.Expense.create(payload);
      }

      // Update/create vendor record
      if (payload.vendor_name) {
        const vendors = await base44.entities.Vendor.filter({ name: payload.vendor_name });
        if (vendors.length > 0) {
          await base44.entities.Vendor.update(vendors[0].id, {
            receipt_count: (vendors[0].receipt_count || 0) + (expenseId ? 0 : 1),
            total_expenses: (vendors[0].total_expenses || 0) + (expenseId ? 0 : (payload.total_amount || 0)),
            last_expense_date: payload.date || vendors[0].last_expense_date,
            default_category: payload.category || vendors[0].default_category,
          });
        } else if (!expenseId) {
          await base44.entities.Vendor.create({
            name: payload.vendor_name,
            tax_id: payload.vendor_tax_id || '',
            default_category: payload.category || '',
            receipt_count: 1,
            total_expenses: payload.total_amount || 0,
            last_expense_date: payload.date,
            address: payload.vendor_address || '',
            phone: payload.vendor_phone || '',
          });
        }
      }

      // Upload to Google Drive (non-blocking)
      if (expense?.receipt_url) {
        const ext = expense.receipt_url.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `${payload.vendor_name || 'קבלה'}_${payload.date || new Date().toISOString().slice(0,10)}.${ext}`;
        supabase.auth.getSession().then(({ data: { session } }) => {
          fetch('/api/google/upload-to-drive', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({ file_url: expense.receipt_url, file_name: fileName }),
          }).catch(() => {});
        });
      }

      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success(expenseId ? 'ההוצאה עודכנה ועברה לאישור' : 'ההוצאה נשמרה בהצלחה!');
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      if (err.message !== 'cancelled') toast.error('שגיאה בשמירה');
    },
  });

  const isPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf') || fileUrl?.toLowerCase().includes('.pdf');

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>
            {step === 'upload' && 'הוספת הוצאה'}
            {step === 'processing' && 'סורק קבלה...'}
            {step === 'review' && 'בדיקת פרטים לפני שמירה'}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4">

          {/* ── Upload step ── */}
          {step === 'upload' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="p-4 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-colors">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">צילום קבלה</p>
                  <p className="text-xs text-muted-foreground mt-1">צלם ישירות מהמצלמה</p>
                </div>
              </button>

              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.heic" className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="p-4 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-colors">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">העלאת קובץ</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC, PDF</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setExtractedData({ has_receipt: false, status: 'missing_receipt', date: new Date().toISOString().split('T')[0] });
                  setStep('review');
                }}
                className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="p-4 bg-primary/10 rounded-2xl group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">הזנה ידנית</p>
                  <p className="text-xs text-muted-foreground mt-1">ללא קבלה</p>
                </div>
              </button>
            </div>
          )}

          {/* ── Processing step ── */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">סורק את הקבלה...</p>
              <p className="text-sm text-muted-foreground mt-1">מחלץ נתונים באמצעות AI</p>
            </div>
          )}

          {/* ── Review step ── */}
          {step === 'review' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Receipt preview */}
              {(previewUrl || fileUrl) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">תצוגת קבלה</p>
                    <div className="flex gap-1">
                      {!isPdf && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation(r => r + 90)}>
                          <RotateCw className="w-4 h-4" />
                        </Button>
                      )}
                      {(fileUrl || initialReceiptUrl) && (
                        <a href={fileUrl || initialReceiptUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="bg-muted rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[500px]">
                    {isPdf ? (
                      <iframe src={previewUrl || fileUrl || initialReceiptUrl} className="w-full h-[500px] rounded-xl" title="קבלה" />
                    ) : (
                      <img
                        src={previewUrl || fileUrl || initialReceiptUrl}
                        alt="קבלה"
                        className="max-w-full max-h-[500px] object-contain transition-transform"
                        style={{ transform: `rotate(${rotation}deg)` }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">פרטי ההוצאה</h3>
                  {!initialReceiptUrl && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setStep('upload'); setFile(null); setPreviewUrl(''); }}>
                      <X className="w-3.5 h-3.5 ml-1" /> החלף קובץ
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">שם ספק</Label>
                    <Input className="h-8 text-sm" value={extractedData.vendor_name || ''} onChange={e => upd('vendor_name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ח.פ.</Label>
                    <Input className="h-8 text-sm" value={extractedData.vendor_tax_id || ''} onChange={e => upd('vendor_tax_id', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">תאריך</Label>
                    <Input className="h-8 text-sm" type="date" value={extractedData.date || ''} onChange={e => upd('date', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מספר קבלה</Label>
                    <Input className="h-8 text-sm" value={extractedData.receipt_number || ''} onChange={e => upd('receipt_number', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">סכום כולל ₪</Label>
                    <Input className="h-8 text-sm" type="number" value={extractedData.total_amount || ''} onChange={e => upd('total_amount', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">לפני מע״מ</Label>
                    <Input className="h-8 text-sm" type="number" value={extractedData.amount_before_vat || ''} onChange={e => upd('amount_before_vat', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מע״מ</Label>
                    <Input className="h-8 text-sm" type="number" value={extractedData.vat_amount || ''} onChange={e => upd('vat_amount', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">קטגוריה</Label>
                    <Select value={extractedData.category || ''} onValueChange={v => upd('category', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר" /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">אמצעי תשלום</Label>
                    <Select value={extractedData.payment_method || ''} onValueChange={v => upd('payment_method', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר" /></SelectTrigger>
                      <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">מטבע</Label>
                    <Select value={extractedData.currency || 'ILS'} onValueChange={v => upd('currency', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ILS">₪ שקל</SelectItem>
                        <SelectItem value="USD">$ דולר</SelectItem>
                        <SelectItem value="EUR">€ יורו</SelectItem>
                        <SelectItem value="GBP">£ ליש״ט</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מספר חשבונית</Label>
                    <Input className="h-8 text-sm" value={extractedData.invoice_number || ''} onChange={e => upd('invoice_number', e.target.value)} />
                  </div>
                </div>

                {isAdminView && agents.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">שיוך לסוכן</Label>
                    <Select value={extractedData.agent_id || ''} onValueChange={v => {
                      const ag = agents.find(a => a.id === v);
                      upd('agent_id', v);
                      upd('agent_name', ag?.name || '');
                    }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר סוכן" /></SelectTrigger>
                      <SelectContent>{agents.filter(a => a.is_active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">הערות</Label>
                  <Textarea className="text-sm" rows={2} value={extractedData.notes || ''} onChange={e => upd('notes', e.target.value)} />
                </div>

                <Button
                  className="w-full rounded-xl gap-2"
                  onClick={() => saveMutation.mutate(extractedData)}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  שמור הוצאה
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
