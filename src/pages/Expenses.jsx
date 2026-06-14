import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

const THIS_YEAR = String(new Date().getFullYear());
const THIS_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Pencil, Trash2, Upload, Plus, Download, PenLine, Mail, Sparkles, TrendingDown, Receipt, FileX, Loader2, FileSpreadsheet, ScanLine, CalendarDays } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ReceiptReviewDialog from '@/components/ReceiptReviewDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { formatCurrency, STATUS_MAP, PAYMENT_METHODS } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import ExpenseEditDialog from '@/components/expenses/ExpenseEditDialog';
import ExcelImportDialog from '@/components/ExcelImportDialog';
import { supabase } from '@/lib/supabase';



// ── Gmail Inbox Tab ───────────────────────────────────────────
function GmailInboxTab({ inboxExpenses, isLoading, onDelete, isAdminView }) {
  const [reviewExpense, setReviewExpense] = useState(null);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">טוען...</div>;

  if (inboxExpenses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Mail className="w-10 h-10 mx-auto mb-3 text-violet-400" />
        <p className="font-medium">אין חשבוניות ממייל</p>
        <p className="text-sm mt-1">לחץ "סרוק עכשיו" בהגדרות → חיבורים → Gmail</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Mail className="w-4 h-4 text-violet-500" />
        {inboxExpenses.length} חשבוניות ממתינות לחילוץ פרטים
      </p>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">קובץ / נושא</TableHead>
              <TableHead className="text-right">פרטי מייל</TableHead>
              <TableHead className="text-right">תאריך מייל</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inboxExpenses.map(expense => (
              <TableRow key={expense.id}>
                <TableCell className="font-medium text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-violet-500" />
                    </div>
                    <span className="truncate max-w-[180px]">{expense.vendor_name || 'ללא שם'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{expense.notes || '-'}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl text-xs bg-violet-600 hover:bg-violet-700"
                      onClick={() => setReviewExpense(expense)}
                      disabled={!expense.receipt_url}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      חלץ פרטים
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (window.confirm('למחוק חשבונית זו?')) onDelete(expense.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {reviewExpense && (
        <ReceiptReviewDialog
          open={!!reviewExpense}
          onClose={() => setReviewExpense(null)}
          receiptUrl={reviewExpense.receipt_url}
          expenseId={reviewExpense.id}
          isAdminView={isAdminView}
          onSaved={() => setReviewExpense(null)}
        />
      )}
    </div>
  );
}

// ── Main Expenses Page ────────────────────────────────────────
export default function Expenses() {
  const { user } = useCurrentUser();
  const isAdminView = useIsAdminView();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [filterMode, setFilterMode] = useState('month'); // 'month' | 'range' | 'year'
  const [filterMonth, setFilterMonth] = useState(THIS_MONTH);
  const [filterFromMonth, setFilterFromMonth] = useState(THIS_MONTH);
  const [filterToMonth, setFilterToMonth] = useState(THIS_MONTH);
  const [filterYear, setFilterYear] = useState(THIS_YEAR);
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const tableRef = useRef(null);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditExpense({});
      setSearchParams({}, { replace: true });
    }
  }, []);

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });
  const { data: allExpenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date', 500),
  });

  const myAgent = agents.find(a => a.user_id === user?.id);

  const allUserExpenses = useMemo(() => {
    if (isAdminView) return allExpenses;
    return allExpenses.filter(e => e.agent_id === myAgent?.id || e.created_by_id === user?.id);
  }, [allExpenses, user, myAgent]);

  const expenses = useMemo(() => allUserExpenses.filter(e => e.status !== 'gmail_inbox'), [allUserExpenses]);
  const gmailInbox = useMemo(() => allUserExpenses.filter(e => e.status === 'gmail_inbox'), [allUserExpenses]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('ההוצאה נמחקה'); },
    onError: () => toast.error('שגיאה במחיקת ההוצאה'),
  });

  // Date filter logic
  const matchesDate = (e) => {
    if (!e.date) return false;
    const m = e.date.slice(0, 7); // YYYY-MM
    const y = e.date.slice(0, 4); // YYYY
    if (filterMode === 'month') return m === filterMonth;
    if (filterMode === 'range') return m >= filterFromMonth && m <= filterToMonth;
    if (filterMode === 'year') return y === filterYear;
    return true;
  };

  const filtered = useMemo(() => expenses.filter(e => {
    const matchSearch = !search || e.vendor_name?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase());
    const matchAgent = agentFilter === 'all' || e.agent_id === agentFilter;
    return matchSearch && matchAgent && matchesDate(e);
  }), [expenses, search, agentFilter, filterMode, filterMonth, filterFromMonth, filterToMonth, filterYear]);

  // Annual total (no VAT) — all expenses in the selected year
  const currentYear = filterMode === 'year' ? filterYear : filterMonth?.slice(0, 4) || filterFromMonth?.slice(0, 4) || THIS_YEAR;
  const annualExpenses = useMemo(() =>
    expenses.filter(e => {
      const matchYear = e.date?.slice(0, 4) === currentYear;
      const matchAgent = agentFilter === 'all' || e.agent_id === agentFilter;
      return matchYear && matchAgent;
    }),
    [expenses, currentYear, agentFilter]
  );

  const expenseStats = useMemo(() => ({
    totalNoVat: filtered.reduce((s, e) => s + (e.amount_before_vat || 0), 0),
    totalVat: filtered.reduce((s, e) => s + (e.vat_amount || 0), 0),
    totalWithVat: filtered.reduce((s, e) => s + (e.total_amount || 0), 0),
    annualNoVat: annualExpenses.reduce((s, e) => s + (e.amount_before_vat || 0), 0),
  }), [filtered, annualExpenses]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = filtered.map(e => ({
      תאריך: e.date || '',
      ספק: e.vendor_name || '',
      'מספר חשבונית': e.invoice_number || '',
      קטגוריה: e.category || '',
      'סכום לפני מע"מ': e.amount_before_vat || 0,
      'מע"מ': e.vat_amount || 0,
      'סכום כולל מע"מ': e.total_amount || 0,
      סוכן: e.agent_name || '',
      'אמצעי תשלום': e.payment_method || '',
      הערות: e.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'הוצאות');
    XLSX.writeFile(wb, `הוצאות_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('הקובץ יוצא בהצלחה');
  };

  const exportPDF = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(tableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgW, imgH);
      pdf.save(`הוצאות_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('הדוח יוצא בהצלחה');
    } catch { toast.error('שגיאה בייצוא PDF'); }
    finally { setExporting(false); }
  };

  const handleScanGmail = async () => {
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch('/api/google/scan-gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בסריקה');
      if (data.created > 0) {
        toast.success(`נמצאו ${data.found} מיילים — ${data.created} חשבוניות נוספו`);
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
      } else if (data.found > 0) {
        toast.info(`נמצאו ${data.found} מיילים אך לא זוהו קבצים חדשים`);
      } else {
        toast.info('לא נמצאו קבלות חדשות במייל (30 ימים אחרונים)');
      }
    } catch (err) {
      toast.error(err.message || 'שגיאה בסריקת Gmail');
    } finally {
      setScanning(false);
    }
  };

  // Available years from data
  const availableYears = useMemo(() => {
    const years = [...new Set(expenses.map(e => e.date?.slice(0, 4)).filter(Boolean))].sort().reverse();
    if (!years.includes(THIS_YEAR)) years.unshift(THIS_YEAR);
    return years;
  }, [expenses]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="me-auto">
          <h1 className="text-2xl font-bold">קבלות והוצאות</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} הוצאות</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={handleScanGmail} disabled={scanning}>
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
          {scanning ? 'סורק...' : 'סרוק עכשיו'}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setShowImport(true)}>
          <FileSpreadsheet className="w-4 h-4" /> ייבוא מאקסל
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportExcel}>
          <Download className="w-4 h-4" /> Excel
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportPDF} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
        </Button>
        <Button className="gap-1.5 rounded-xl" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" /> הוצאה חדשה
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600"><TrendingDown className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ ללא מע״מ</p><p className="text-xl font-bold">{formatCurrency(expenseStats.totalNoVat)}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600"><Receipt className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ מע״מ</p><p className="text-xl font-bold">{formatCurrency(expenseStats.totalVat)}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100 text-red-600"><FileX className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ כולל מע״מ</p><p className="text-xl font-bold">{formatCurrency(expenseStats.totalWithVat)}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600"><CalendarDays className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ שנתי ללא מע״מ</p><p className="text-xl font-bold">{formatCurrency(expenseStats.annualNoVat)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="expenses" className="gap-2 rounded-lg">הוצאות ({expenses.length})</TabsTrigger>
          <TabsTrigger value="gmail" className="gap-2 rounded-lg">
            <Mail className="w-4 h-4" /> חשבוניות ממייל
            {gmailInbox.length > 0 && (
              <span className="ms-1 bg-violet-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{gmailInbox.length}</span>
            )}
          </TabsTrigger>

        </TabsList>

        {/* ── הוצאות Tab ── */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-xl border overflow-hidden shrink-0">
                  {[['month', 'חודש'], ['range', 'טווח'], ['year', 'שנה']].map(([mode, label]) => (
                    <button key={mode} onClick={() => setFilterMode(mode)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {filterMode === 'month' && (
                  <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-36 rounded-xl shrink-0" />
                )}
                {filterMode === 'range' && (
                  <>
                    <Input type="month" value={filterFromMonth} onChange={e => setFilterFromMonth(e.target.value)} className="w-36 rounded-xl shrink-0" />
                    <span className="text-muted-foreground text-sm">—</span>
                    <Input type="month" value={filterToMonth} onChange={e => setFilterToMonth(e.target.value)} className="w-36 rounded-xl shrink-0" />
                  </>
                )}
                {filterMode === 'year' && (
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="w-32 rounded-xl shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="חיפוש ספק, קטגוריה..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
                </div>
                {isAdminView && (
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="כל הסוכנים" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הסוכנים</SelectItem>
                      {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl overflow-hidden" ref={tableRef}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-right">קבלה</TableHead>
                    {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">לפני מע״מ</TableHead>
                    <TableHead className="text-right">מע״מ</TableHead>
                    <TableHead className="text-right">כולל מע״מ</TableHead>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">לא נמצאו הוצאות</TableCell></TableRow>
                  ) : filtered.map(expense => (
                    <TableRow key={expense.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setViewExpense(expense)}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => setEditExpense(expense)}><Pencil className="w-4 h-4 ml-2" /> עריכה</DropdownMenuItem>
                            {expense.receipt_url && (
                              <DropdownMenuItem onClick={() => window.open(expense.receipt_url, '_blank')}>
                                <Download className="w-4 h-4 ml-2" /> פתח קבלה
                              </DropdownMenuItem>
                            )}
                            {isAdminView && (
                              <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`למחוק את ההוצאה "${expense.vendor_name}"?`)) deleteMutation.mutate(expense.id); }}>
                                <Trash2 className="w-4 h-4 ml-2" /> מחיקה
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-right">
                        {expense.has_receipt
                          ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">יש</Badge>
                          : <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">חסרה</Badge>}
                      </TableCell>
                      {isAdminView && <TableCell className="text-sm text-muted-foreground text-right">{expense.agent_name || '-'}</TableCell>}
                      <TableCell className="text-sm text-right">{expense.category || '-'}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(expense.amount_before_vat || 0)}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(expense.vat_amount || 0)}</TableCell>
                      <TableCell className="font-semibold text-sm text-right">{formatCurrency(expense.total_amount, expense.currency)}</TableCell>
                      <TableCell className="font-medium text-sm text-right">{expense.vendor_name || '-'}</TableCell>
                      <TableCell className="text-sm text-right">{expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── חשבוניות ממייל Tab ── */}
        <TabsContent value="gmail" className="mt-4">
          <GmailInboxTab
            inboxExpenses={gmailInbox}
            isLoading={isLoading}
            onDelete={(id) => deleteMutation.mutate(id)}
            isAdminView={isAdminView}
          />
        </TabsContent>


      </Tabs>

      {/* View Dialog */}
      <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>פרטי הוצאה</DialogTitle></DialogHeader>
          {viewExpense && (
            <div className="space-y-3 text-sm">
              {viewExpense.receipt_url && (
                <div className="bg-muted rounded-xl overflow-hidden mb-4">
                  <img src={viewExpense.receipt_url} alt="קבלה" className="w-full max-h-64 object-contain" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['ספק', viewExpense.vendor_name],
                  ['תאריך', viewExpense.date ? format(new Date(viewExpense.date), 'dd/MM/yyyy') : '-'],
                  ['לפני מע״מ', formatCurrency(viewExpense.amount_before_vat || 0)],
                  ['מע״מ', formatCurrency(viewExpense.vat_amount || 0)],
                  ['סכום כולל', formatCurrency(viewExpense.total_amount, viewExpense.currency)],
                  ['מספר חשבונית', viewExpense.invoice_number || '-'],
                  ['קטגוריה', viewExpense.category || '-'],
                  ['סוכן', viewExpense.agent_name || '-'],
                  ['אמצעי תשלום', PAYMENT_METHODS[viewExpense.payment_method] || '-'],
                ].map(([label, value]) => (
                  <div key={label}><p className="text-muted-foreground text-xs">{label}</p><p className="font-medium">{value}</p></div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setEditExpense(viewExpense); setViewExpense(null); }}>
                  <Pencil className="w-4 h-4 ml-2" /> ערוך
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editExpense !== null && (
        <ExpenseEditDialog expense={editExpense} categories={categories} agents={agents} currentUser={user} myAgent={myAgent} onClose={() => setEditExpense(null)} />
      )}

      {/* Add expense modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>הוצאה חדשה</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <button
              className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-right"
              onClick={() => { setShowAddModal(false); setEditExpense({}); }}
            >
              <div className="p-3 bg-purple-100 rounded-xl">
                <PenLine className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">הוספה ידנית</p>
                <p className="text-xs text-muted-foreground">הזן פרטים ידנית</p>
              </div>
            </button>
            <button
              className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-right"
              onClick={() => { setShowAddModal(false); setShowReceiptDialog(true); }}
            >
              <div className="p-3 bg-amber-100 rounded-xl">
                <Upload className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">העלאת מסמך + סריקה</p>
                <p className="text-xs text-muted-foreground">תמונה או PDF עם חילוץ נתונים אוטומטי</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ReceiptReviewDialog
        open={showReceiptDialog}
        onClose={() => setShowReceiptDialog(false)}
        isAdminView={isAdminView}
        onSaved={() => setShowReceiptDialog(false)}
      />

      {showImport && (
        <ExcelImportDialog
          type="expenses"
          agents={agents}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
