import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Camera, FileText, Loader2, CheckCircle2, X, RotateCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function UploadReceipt() {
  const [step, setStep] = useState('upload'); // upload, processing, review
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [extractedData, setExtractedData] = useState({});
  const [rotation, setRotation] = useState(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setStep('processing');

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setFileUrl(file_url);

      let extractedResult = null;
      try {
        extractedResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              vendor_name: { type: "string", description: "Business/vendor name" },
              vendor_tax_id: { type: "string", description: "Tax ID / business number" },
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              receipt_number: { type: "string", description: "Receipt number" },
              invoice_number: { type: "string", description: "Invoice number" },
              total_amount: { type: "number", description: "Total amount including VAT" },
              amount_before_vat: { type: "number", description: "Amount before VAT" },
              vat_amount: { type: "number", description: "VAT amount" },
              payment_method: { type: "string", description: "Payment method" },
              currency: { type: "string", description: "Currency code: ILS, USD, EUR, GBP" },
              vendor_address: { type: "string", description: "Business address" },
              vendor_phone: { type: "string", description: "Business phone" },
            }
          }
        });
      } catch {
        toast.error('שגיאה בסריקת הקבלה — ניתן להזין פרטים ידנית');
      }

      if (extractedResult?.status === 'success' && extractedResult.output) {
        let suggestedCategory = '';
        if (extractedResult.output.vendor_name && categories.length > 0) {
          try {
            const catResult = await base44.integrations.Core.InvokeLLM({
              prompt: `Given this vendor name: "${extractedResult.output.vendor_name}", suggest the most appropriate expense category from this list: ${categories.map(c => c.name).join(', ')}. Return ONLY the category name, nothing else.`,
            });
            suggestedCategory = catResult?.trim() || '';
          } catch {
            // categorization failure is non-fatal
          }
        }

        setExtractedData({
          ...extractedResult.output,
          category: suggestedCategory || '',
          receipt_url: file_url,
          has_receipt: true,
          status: 'pending_approval',
        });
      } else {
        setExtractedData({ receipt_url: file_url, has_receipt: true, status: 'pending_approval' });
      }
      setStep('review');
    } catch {
      toast.error('שגיאה בהעלאת הקובץ — אנא נסה שוב');
      setStep('upload');
      setFile(null);
      setPreviewUrl('');
    }
  };

  const updateField = (field, value) => {
    setExtractedData(prev => ({ ...prev, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Check for duplicates
      const existing = await base44.entities.Expense.filter({
        vendor_name: data.vendor_name,
        total_amount: data.total_amount,
        date: data.date,
      });
      if (existing.length > 0) {
        const confirmSave = window.confirm('נראה שקבלה דומה כבר קיימת במערכת. להמשיך בשמירה?');
        if (!confirmSave) throw new Error('cancelled');
      }

      const expense = await base44.entities.Expense.create(data);

      // Update or create vendor
      if (data.vendor_name) {
        const vendors = await base44.entities.Vendor.filter({ name: data.vendor_name });
        if (vendors.length > 0) {
          await base44.entities.Vendor.update(vendors[0].id, {
            receipt_count: (vendors[0].receipt_count || 0) + 1,
            total_expenses: (vendors[0].total_expenses || 0) + (data.total_amount || 0),
            last_expense_date: data.date,
            default_category: data.category || vendors[0].default_category,
          });
        } else {
          await base44.entities.Vendor.create({
            name: data.vendor_name,
            tax_id: data.vendor_tax_id || '',
            default_category: data.category || '',
            receipt_count: 1,
            total_expenses: data.total_amount || 0,
            last_expense_date: data.date,
            address: data.vendor_address || '',
            phone: data.vendor_phone || '',
          });
        }
      }

      // Log activity
      await base44.entities.ActivityLog.create({
        action: 'upload',
        entity_type: 'Expense',
        entity_id: expense.id,
        description: `הועלתה קבלה: ${data.vendor_name} - ₪${data.total_amount}`,
      });

      return expense;
    },
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('ההוצאה נשמרה בהצלחה!');
      // Upload to Google Drive in background — non-blocking
      if (expense?.receipt_url) {
        const ext = expense.receipt_url.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `${expense.vendor_name || 'קבלה'}_${expense.date || new Date().toISOString().split('T')[0]}.${ext}`;
        fetch('/api/google/upload-to-drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: expense.receipt_url, file_name: fileName }),
        }).catch(() => {}); // silent fail
      }
      navigate('/expenses');
    },
    onError: (err) => {
      if (err.message !== 'cancelled') toast.error('שגיאה בשמירה');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(extractedData);
  };

  const resetUpload = () => {
    setStep('upload');
    setFile(null);
    setFileUrl('');
    setPreviewUrl('');
    setExtractedData({});
    setRotation(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">העלאת קבלה</h1>
        <p className="text-muted-foreground text-sm mt-1">צלם או העלה קבלה לסריקה אוטומטית</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="rounded-2xl">
              <CardContent className="p-8">
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
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium">סורק את הקבלה...</p>
            <p className="text-sm text-muted-foreground mt-1">מחלץ נתונים באמצעות AI</p>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left side - Image preview */}
              {previewUrl && (
                <Card className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">תצוגת קבלה</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation(r => r + 90)}>
                          <RotateCw className="w-4 h-4" />
                        </Button>
                        {fileUrl && (
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted rounded-xl overflow-hidden flex items-center justify-center min-h-[400px]">
                      <img
                        src={previewUrl}
                        alt="קבלה"
                        className="max-w-full max-h-[600px] object-contain transition-transform"
                        style={{ transform: `rotate(${rotation}deg)` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Right side - Form */}
              <Card className="rounded-2xl">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">פרטי ההוצאה</h3>
                    <Button variant="ghost" size="sm" onClick={resetUpload}>
                      <X className="w-4 h-4 ml-1" /> התחל מחדש
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">שם ספק</Label>
                      <Input value={extractedData.vendor_name || ''} onChange={(e) => updateField('vendor_name', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">ח.פ.</Label>
                      <Input value={extractedData.vendor_tax_id || ''} onChange={(e) => updateField('vendor_tax_id', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">תאריך</Label>
                      <Input type="date" value={extractedData.date || ''} onChange={(e) => updateField('date', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">מספר קבלה</Label>
                      <Input value={extractedData.receipt_number || ''} onChange={(e) => updateField('receipt_number', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">סכום כולל</Label>
                      <Input type="number" value={extractedData.total_amount || ''} onChange={(e) => updateField('total_amount', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">לפני מע״מ</Label>
                      <Input type="number" value={extractedData.amount_before_vat || ''} onChange={(e) => updateField('amount_before_vat', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">מע״מ</Label>
                      <Input type="number" value={extractedData.vat_amount || ''} onChange={(e) => updateField('vat_amount', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">קטגוריה</Label>
                      <Select value={extractedData.category || ''} onValueChange={(v) => updateField('category', v)}>
                        <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">אמצעי תשלום</Label>
                      <Select value={extractedData.payment_method || ''} onValueChange={(v) => updateField('payment_method', v)}>
                        <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">מטבע</Label>
                      <Select value={extractedData.currency || 'ILS'} onValueChange={(v) => updateField('currency', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ILS">₪ שקל</SelectItem>
                          <SelectItem value="USD">$ דולר</SelectItem>
                          <SelectItem value="EUR">€ יורו</SelectItem>
                          <SelectItem value="GBP">£ ליש״ט</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">מספר חשבונית</Label>
                      <Input value={extractedData.invoice_number || ''} onChange={(e) => updateField('invoice_number', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">לקוח</Label>
                      <Select value={extractedData.client || ''} onValueChange={(v) => updateField('client', v)}>
                        <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">פרויקט</Label>
                      <Select value={extractedData.project || ''} onValueChange={(v) => updateField('project', v)}>
                        <SelectTrigger><SelectValue placeholder="בחר פרויקט" /></SelectTrigger>
                        <SelectContent>
                          {projects.map(p => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">הערות</Label>
                    <Textarea value={extractedData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={2} />
                  </div>

                  <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full rounded-xl gap-2">
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    שמור הוצאה
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}