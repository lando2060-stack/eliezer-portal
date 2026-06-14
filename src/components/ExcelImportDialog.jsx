import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle, XCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

// ── Column mappings ────────────────────────────────────────────

const DEAL_COL_MAP = {
  'שם לקוח': 'client_name',
  'כתובת': 'address',
  'חודש': 'month',
  'אזור': 'area',
  'צד': 'side',
  'סכום עסקה': 'deal_amount',
  '% עמלה': 'commission_percent',
  '% סוכן': 'agent_commission_percent',
  'שם סוכן': 'agent_name',
  'סטטוס': 'status',
  'שם עו"ד': 'lawyer_name',
  'סוכן שיתוף': 'cooperation_agent',
  'מקור ליד': 'lead_source',
  'הערות': 'notes',
};

const EXPENSE_COL_MAP = {
  'תאריך': 'date',
  'ספק': 'vendor_name',
  'מספר חשבונית': 'invoice_number',
  'קטגוריה': 'category',
  'סכום לפני מע"מ': 'amount_before_vat',
  'מע"מ': 'vat_amount',
  'סכום כולל מע"מ': 'total_amount',
  'אמצעי תשלום': 'payment_method',
  'שם סוכן': 'agent_name',
  'הערות': 'notes',
};

const PAYMENT_COL_MAP = {
  'תאריך': 'date',
  'שם לקוח': 'deal_client_name',
  'סכום': 'amount',
  'אמצעי תשלום': 'payment_method',
  'הערות': 'notes',
};

// ── Sample rows ────────────────────────────────────────────────

const DEAL_SAMPLE = [{
  'שם לקוח': 'ישראל ישראלי',
  'כתובת': 'רחוב הרצל 5, תל אביב',
  'חודש': '2024-01',
  'אזור': 'תל אביב',
  'צד': 'קונה',
  'סכום עסקה': 1500000,
  '% עמלה': 2,
  '% סוכן': 50,
  'שם סוכן': 'שם הסוכן',
  'סטטוס': 'פתוחה',
  'שם עו"ד': 'דוד כהן',
  'סוכן שיתוף': '',
  'מקור ליד': 'יד2',
  'הערות': '',
}];

const EXPENSE_SAMPLE = [{
  'תאריך': '2024-01-15',
  'ספק': 'חברת פרסום',
  'מספר חשבונית': '12345',
  'קטגוריה': 'פרסום',
  'סכום לפני מע"מ': 1273,
  'מע"מ': 229,
  'סכום כולל מע"מ': 1502,
  'אמצעי תשלום': 'credit_card',
  'שם סוכן': 'שם הסוכן',
  'הערות': '',
}];

const PAYMENT_SAMPLE = [{
  'תאריך': '2024-01-20',
  'שם לקוח': 'ישראל ישראלי',
  'סכום': 30000,
  'אמצעי תשלום': 'העברה בנקאית',
  'הערות': '',
}];

// ── Helpers ────────────────────────────────────────────────────

function downloadSample(type) {
  const data = type === 'deals' ? DEAL_SAMPLE : type === 'expenses' ? EXPENSE_SAMPLE : PAYMENT_SAMPLE;
  const sheetName = type === 'deals' ? 'עסקאות' : type === 'expenses' ? 'הוצאות' : 'הכנסות';
  const filename = type === 'deals' ? 'קובץ_דוגמא_עסקאות.xlsx' : type === 'expenses' ? 'קובץ_דוגמא_הוצאות.xlsx' : 'קובץ_דוגמא_הכנסות.xlsx';
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function toDateStr(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return str;
}

function toMonthStr(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  const mmy = str.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmy) return `${mmy[2]}-${mmy[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str.slice(0, 7);
  return str;
}

// ── Main component ─────────────────────────────────────────────

export default function ExcelImportDialog({ type, agents = [], deals = [], onClose }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const colMap = type === 'deals' ? DEAL_COL_MAP : type === 'expenses' ? EXPENSE_COL_MAP : PAYMENT_COL_MAP;
  const typeName = type === 'deals' ? 'עסקאות' : type === 'expenses' ? 'הוצאות' : 'הכנסות';

  const processFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsed = raw
          .map((row) => {
            const mapped = {};
            Object.entries(row).forEach(([col, val]) => {
              const field = colMap[col.trim()];
              if (field) mapped[field] = val;
            });
            return mapped;
          })
          .filter((r) => Object.keys(r).length > 0);
        setRows(parsed);
        setResults(null);
      } catch {
        toast.error('שגיאה בקריאת הקובץ — ודא שהקובץ הוא xlsx או xls תקין');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [colMap]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const findDeal = (clientName) =>
    deals.find((d) => d.client_name?.trim() === String(clientName || '').trim());

  const isValid = (row) => {
    if (type === 'deals') return !!row.client_name && parseFloat(row.deal_amount) > 0;
    if (type === 'expenses') return !!row.vendor_name && parseFloat(row.total_amount) > 0;
    // payments: require date, client_name, amount, and a matching deal
    return !!row.date && !!row.deal_client_name && parseFloat(row.amount) > 0 && !!findDeal(row.deal_client_name);
  };

  const buildDealPayload = (row) => {
    const agent = agents.find((a) => a.name === String(row.agent_name || '').trim());
    const dealAmount = parseFloat(row.deal_amount) || 0;
    const commPct = parseFloat(row.commission_percent) || 0;
    const agentPct = parseFloat(row.agent_commission_percent) || agent?.commission_percent || 50;
    const commAmount = parseFloat(((dealAmount * commPct) / 100).toFixed(2));
    const agentComm = parseFloat(((commAmount * agentPct) / 100).toFixed(2));
    const officeComm = parseFloat((commAmount - agentComm).toFixed(2));
    return {
      client_name: row.client_name || '',
      address: row.address || '',
      month: toMonthStr(row.month),
      area: row.area || '',
      side: row.side || '',
      deal_amount: dealAmount,
      commission_percent: commPct,
      agent_commission_percent: agentPct,
      commission_amount: commAmount,
      agent_commission: agentComm,
      office_commission: officeComm,
      agent_id: agent?.id || '',
      agent_name: agent?.name || String(row.agent_name || ''),
      status: row.status || 'פתוחה',
      lawyer_name: row.lawyer_name || '',
      cooperation_agent: row.cooperation_agent || '',
      lead_source: row.lead_source || '',
      origin: row.origin || '',
      notes: row.notes || '',
      has_invoice: false,
    };
  };

  const buildExpensePayload = (row) => {
    const agent = agents.find((a) => a.name === String(row.agent_name || '').trim());
    const amountBeforeVat = parseFloat(row.amount_before_vat) || 0;
    const vatAmount = parseFloat(row.vat_amount) || 0;
    const totalAmount = parseFloat(row.total_amount) || (amountBeforeVat + vatAmount) || 0;
    return {
      date: toDateStr(row.date),
      vendor_name: row.vendor_name || '',
      invoice_number: row.invoice_number || '',
      total_amount: totalAmount,
      amount_before_vat: amountBeforeVat,
      vat_amount: vatAmount,
      category: row.category || '',
      payment_method: row.payment_method || '',
      notes: row.notes || '',
      agent_id: agent?.id || '',
      agent_name: agent?.name || String(row.agent_name || ''),
      scope: 'office',
      status: 'approved',
      has_receipt: false,
    };
  };

  const handleImport = async () => {
    const valid = rows.filter(isValid);
    if (valid.length === 0) {
      toast.error('אין שורות תקינות לייבוא');
      return;
    }

    setImporting(true);
    let success = 0;
    let failed = 0;

    if (type === 'payments') {
      // Group payments by deal to batch-update collected_actual once per deal
      const byDeal = new Map();
      for (const row of valid) {
        const deal = findDeal(row.deal_client_name);
        if (!byDeal.has(deal.id)) byDeal.set(deal.id, { deal, rows: [] });
        byDeal.get(deal.id).rows.push(row);
      }

      for (const { deal, rows: dealRows } of byDeal.values()) {
        for (const row of dealRows) {
          try {
            await base44.entities.Payment.create({
              amount: parseFloat(row.amount),
              date: toDateStr(row.date),
              payment_method: row.payment_method || '',
              notes: row.notes || '',
              deal_id: deal.id,
              deal_client_name: deal.client_name,
              deal_address: deal.address || '',
              agent_id: deal.agent_id || '',
              agent_name: deal.agent_name || '',
            });
            success++;
          } catch {
            failed++;
          }
        }
        // Recalculate collected_actual for this deal
        try {
          const allP = await base44.entities.Payment.filter({ deal_id: deal.id });
          const newCollected = allP.reduce((s, p) => s + (p.amount || 0), 0);
          await base44.entities.Deal.update(deal.id, { collected_actual: newCollected });
        } catch {
          // non-critical — payments are already saved
        }
      }
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    } else {
      for (const row of valid) {
        try {
          const payload = type === 'deals' ? buildDealPayload(row) : buildExpensePayload(row);
          if (type === 'deals') await base44.entities.Deal.create(payload);
          else await base44.entities.Expense.create(payload);
          success++;
        } catch {
          failed++;
        }
      }
      queryClient.invalidateQueries({ queryKey: [type === 'deals' ? 'deals' : 'expenses'] });
    }

    setImporting(false);
    setResults({ success, failed });
    if (success > 0) toast.success(`יובאו ${success} ${typeName} בהצלחה`);
    if (failed > 0) toast.error(`${failed} שורות נכשלו`);
  };

  const validCount = rows.filter(isValid).length;
  const invalidCount = rows.length - validCount;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            ייבוא {typeName} מאקסל
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sample download */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div>
              <p className="text-sm font-medium">לא בטוח מה הפורמט?</p>
              <p className="text-xs text-muted-foreground mt-0.5">הורד קובץ דוגמא עם כל העמודות הנדרשות</p>
              {type === 'payments' && (
                <p className="text-xs text-amber-600 mt-1">שדה "שם לקוח" חייב להיות זהה לשם הלקוח בעסקה</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl shrink-0" onClick={() => downloadSample(type)}>
              <Download className="w-4 h-4" /> קובץ דוגמא
            </Button>
          </div>

          {/* Drop zone */}
          {rows.length === 0 && !results && (
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('xlsx-file-input').click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">גרור קובץ Excel לכאן</p>
              <p className="text-sm text-muted-foreground mt-1">או לחץ לבחירת קובץ (.xlsx / .xls)</p>
              <input
                id="xlsx-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !results && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-medium">{rows.length} שורות נמצאו בקובץ</p>
                {invalidCount > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                    {invalidCount} שורות לא תקינות
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="mr-auto text-muted-foreground text-xs" onClick={() => setRows([])}>
                  החלף קובץ
                </Button>
              </div>

              <div className="border rounded-xl overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-8 text-center">#</TableHead>
                      {type === 'deals' && (
                        <>
                          <TableHead className="text-right">לקוח</TableHead>
                          <TableHead className="text-right">כתובת</TableHead>
                          <TableHead className="text-right">סכום עסקה</TableHead>
                          <TableHead className="text-right">סוכן</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                        </>
                      )}
                      {type === 'expenses' && (
                        <>
                          <TableHead className="text-right">ספק</TableHead>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">קטגוריה</TableHead>
                          <TableHead className="text-right">סוכן</TableHead>
                        </>
                      )}
                      {type === 'payments' && (
                        <>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">לקוח</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">אמצעי תשלום</TableHead>
                          <TableHead className="text-right">עסקה</TableHead>
                        </>
                      )}
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => {
                      const valid = isValid(row);
                      const matchedDeal = type === 'payments' ? findDeal(row.deal_client_name) : null;
                      return (
                        <TableRow key={i} className={valid ? '' : 'bg-red-50'}>
                          <TableCell className="text-xs text-center text-muted-foreground">{i + 1}</TableCell>
                          {type === 'deals' && (
                            <>
                              <TableCell className="text-sm">{row.client_name || <span className="text-red-500 text-xs">חסר *</span>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.address || '-'}</TableCell>
                              <TableCell className="text-sm">{row.deal_amount ? `₪${Number(row.deal_amount).toLocaleString()}` : <span className="text-red-500 text-xs">חסר *</span>}</TableCell>
                              <TableCell className="text-sm">{row.agent_name || '-'}</TableCell>
                              <TableCell className="text-sm">{row.status || 'פתוחה'}</TableCell>
                            </>
                          )}
                          {type === 'expenses' && (
                            <>
                              <TableCell className="text-sm">{row.vendor_name || <span className="text-red-500 text-xs">חסר *</span>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.date ? toDateStr(row.date) : '-'}</TableCell>
                              <TableCell className="text-sm">{row.total_amount ? `₪${Number(row.total_amount).toLocaleString()}` : <span className="text-red-500 text-xs">חסר *</span>}</TableCell>
                              <TableCell className="text-sm">{row.category || '-'}</TableCell>
                              <TableCell className="text-sm">{row.agent_name || '-'}</TableCell>
                            </>
                          )}
                          {type === 'payments' && (
                            <>
                              <TableCell className="text-sm">{row.date ? toDateStr(row.date) : <span className="text-red-500 text-xs">חסר *</span>}</TableCell>
                              <TableCell className="text-sm">{row.deal_client_name || <span className="text-red-500 text-xs">חסר *</span>}</TableCell>
                              <TableCell className="text-sm">{row.amount ? `₪${Number(row.amount).toLocaleString()}` : <span className="text-red-500 text-xs">חסר *</span>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.payment_method || '-'}</TableCell>
                              <TableCell className="text-sm">
                                {matchedDeal
                                  ? <span className="text-emerald-600 text-xs">✓ נמצאה</span>
                                  : <span className="text-red-500 text-xs">לא נמצאה</span>}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-center">
                            {valid
                              ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Button
                className="w-full gap-2 rounded-xl"
                onClick={handleImport}
                disabled={importing || validCount === 0}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'מייבא...' : `ייבא ${validCount} ${typeName}`}
              </Button>
            </div>
          )}

          {/* Done */}
          {results && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
              <div>
                <p className="text-lg font-bold">הייבוא הושלם</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.success} {typeName} יובאו בהצלחה
                  {results.failed > 0 && ` • ${results.failed} שורות נכשלו`}
                </p>
              </div>
              <Button className="rounded-xl" onClick={onClose}>סגור</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
