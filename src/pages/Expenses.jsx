import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

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
import { Search, MoreVertical, Pencil, Trash2, Upload, Plus, CheckCircle, Download, PenLine, Mail, Sparkles, TrendingDown, Clock, Receipt, FileX, RefreshCw, Save, Loader2, FileSpreadsheet } from 'lucide-react';
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

// ── Recurring Expenses Tab ────────────────────────────────────
function RecurringExpensesTab() {
  const queryClient = useQueryClient();
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring'], queryFn: () => base44.entities.RecurringExpense.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });

  const empty = { name: '', vendor_name: '', amount: '', category: '', payment_method: '', day_of_month: 1, is_active: true };
  const [newR, setNewR] = useState(null);
  const [editR, setEditR] = useState(null);

  const createR = useMutation({
    mutationFn: (d) => base44.entities.RecurringExpense.create({ ...d, amount: parseFloat(d.amount) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); toast.success('נוצרה הוצאה קבועה'); setNewR(null); },
    onError: () => toast.error('שגיאה ביצירת הוצאה קבועה'),
  });
  const updateR = useMutation({
    mutationFn: ({ id, ...d }) => base44.entities.RecurringExpense.update(id, { ...d, amount: parseFloat(d.amount) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); toast.success('עודכנה'); setEditR(null); },
    onError: () => toast.error('שגיאה בעדכון'),
  });
  const deleteR = useMutation({
    mutationFn: (id) => base44.entities.RecurringExpense.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); toast.success('נמחקה'); },
    onError: () => toast.error('שגיאה במחיקה'),
  });
  const toggleR = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.RecurringExpense.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
    onError: () => toast.error('שגיאה בעדכון הסטטוס'),
  });

  const RecurringForm = ({ data, setData, onSubmit, isPending, submitLabel }) => (
    <div className="space-y-3">
      <div className="space-y-1"><Label className="text-xs">שם *</Label><Input value={data.name} onChange={e => setData(p => ({ ...p, name: e.target.value }))} className="rounded-xl" /></div>
      <div className="space-y-1"><Label className="text-xs">ספק</Label><Input value={data.vendor_name} onChange={e => setData(p => ({ ...p, vendor_name: e.target.value }))} className="rounded-xl" /></div>
      <div className="space-y-1"><Label className="text-xs">סכום *</Label><Input type="number" value={data.amount} onChange={e => setData(p => ({ ...p, amount: e.target.value }))} className="rounded-xl" /></div>
      <div className="space-y-1">
        <Label className="text-xs">קטגוריה</Label>
        <Select value={data.category} onValueChange={v => setData(p => ({ ...p, category: v }))}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="בחר" /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">אמצעי תשלום</Label>
        <Select value={data.payment_method} onValueChange={v => setData(p => ({ ...p, payment_method: v }))}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="בחר" /></SelectTrigger>
          <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label className="text-xs">יום בחודש</Label><Input type="number" min="1" max="31" value={data.day_of_month} onChange={e => setData(p => ({ ...p, day_of_month: parseInt(e.target.value) || 1 }))} className="rounded-xl" /></div>
      <Button onClick={onSubmit} disabled={!data.name || !data.amount || isPending} className="w-full gap-2 rounded-xl">{submitLabel}</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNewR(empty)} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> הוצאה קבועה חדשה</Button>
      </div>

      <Dialog open={!!newR} onOpenChange={() => setNewR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>הוספת הוצאה קבועה</DialogTitle></DialogHeader>
          {newR && <RecurringForm data={newR} setData={setNewR} onSubmit={() => createR.mutate(newR)} isPending={createR.isPending} submitLabel={<><Plus className="w-4 h-4" /> הוסף</>} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editR} onOpenChange={() => setEditR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>עריכת הוצאה קבועה</DialogTitle></DialogHeader>
          {editR && <RecurringForm data={editR} setData={setEditR} onSubmit={() => updateR.mutate(editR)} isPending={updateR.isPending} submitLabel={<><Save className="w-4 h-4" /> שמור שינויים</>} />}
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="w-12"></TableHead>
            <TableHead className="text-right">שם</TableHead>
            <TableHead className="text-right">ספק</TableHead>
            <TableHead className="text-right">סכום</TableHead>
            <TableHead className="text-right">קטגוריה</TableHead>
            <TableHead className="text-right">יום</TableHead>
            <TableHead className="text-right">פעיל</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {recurring.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">אין הוצאות קבועות</TableCell></TableRow>
            ) : recurring.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setEditR({ ...r, amount: r.amount?.toString() ?? '' })}><Pencil className="w-4 h-4 ml-2" /> עריכה</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`למחוק את "${r.name}"?`)) deleteR.mutate(r.id); }}><Trash2 className="w-4 h-4 ml-2" /> מחיקה</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.vendor_name || '-'}</TableCell>
                <TableCell>₪{r.amount?.toLocaleString()}</TableCell>
                <TableCell>{r.category || '-'}</TableCell>
                <TableCell>{r.day_of_month}</TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={v => toggleR.mutate({ id: r.id, is_active: v })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

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
              <TableHead className="text-right">הגיע</TableHead>
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
                  {expense.created_at ? format(new Date(expense.created_at), 'dd/MM/yy HH:mm') : '-'}
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

      {/* Full extract+review dialog — same as manual upload */}
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(THIS_MONTH);
  const [dateTo, setDateTo] = useState(THIS_MONTH);
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  // Split: regular expenses vs gmail inbox
  const expenses = useMemo(() => allUserExpenses.filter(e => e.status !== 'gmail_inbox'), [allUserExpenses]);
  const gmailInbox = useMemo(() => allUserExpenses.filter(e => e.status === 'gmail_inbox'), [allUserExpenses]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('ההוצאה נמחקה'); },
    onError: () => toast.error('שגיאה במחיקת ההוצאה'),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.update(id, { status: 'approved' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('ההוצאה אושרה'); },
    onError: () => toast.error('שגיאה באישור ההוצאה'),
  });

  const filtered = useMemo(() => expenses.filter(e => {
    const matchSearch = !search || e.vendor_name?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchAgent = agentFilter === 'all' || e.agent_id === agentFilter;
    const matchDate = (() => {
      if (!dateFrom && !dateTo) return true;
      if (!e.date) return false;
      const m = e.date.slice(0, 7);
      if (dateFrom && m < dateFrom) return false;
      if (dateTo && m > dateTo) return false;
      return true;
    })();
    return matchSearch && matchStatus && matchAgent && matchDate;
  }), [expenses, search, statusFilter, agentFilter, dateFrom, dateTo]);

  const totalFiltered = filtered.reduce((s, e) => s + (e.total_amount || 0), 0);

  const expenseStats = useMemo(() => ({
    total: expenses.reduce((s, e) => s + (e.total_amount || 0), 0),
    approved: expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.total_amount || 0), 0),
    pending: expenses.filter(e => e.status === 'pending_approval').length,
    missingReceipt: expenses.filter(e => !e.has_receipt).length,
  }), [expenses]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = filtered.map(e => ({
      תאריך: e.date || '',
      ספק: e.vendor_name || '',
      קטגוריה: e.category || '',
      סכום: e.total_amount || 0,
      סטטוס: e.status || '',
      סוכן: e.agent_name || '',
      'אמצעי תשלום': e.payment_method || '',
      הערות: e.notes || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'הוצאות');
    XLSX.writeFile(wb, `הוצאות_${dateFrom || 'כל'}_${dateTo || 'הזמנים'}.xlsx`);
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
      pdf.save(`הוצאות_${dateFrom || 'כל'}_${dateTo || 'הזמנים'}.pdf`);
      toast.success('הדוח יוצא בהצלחה');
    } catch { toast.error('שגיאה בייצוא PDF'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="me-auto">
          <h1 className="text-2xl font-bold">קבלות והוצאות</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} הוצאות • סה״כ {formatCurrency(totalFiltered)}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setShowImport(true)}>
          <FileSpreadsheet className="w-4 h-4" /> ייבוא מאקסל
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportExcel}>
          <Download className="w-4 h-4" /> Excel
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportPDF} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100 text-red-600"><TrendingDown className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ הוצאות</p><p className="text-xl font-bold">{formatCurrency(expenseStats.total)}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600"><Receipt className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">מאושרות</p><p className="text-xl font-bold">{formatCurrency(expenseStats.approved)}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600"><Clock className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">ממתינות לאישור</p><p className="text-xl font-bold">{expenseStats.pending}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-600"><FileX className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">חסרות קבלה</p><p className="text-xl font-bold">{expenseStats.missingReceipt}</p></div>
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
          <TabsTrigger value="recurring" className="gap-2 rounded-lg">
            <RefreshCw className="w-4 h-4" /> הוצאות קבועות
          </TabsTrigger>
        </TabsList>

        {/* ── הוצאות Tab ── */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="חיפוש ספק, קטגוריה..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="סטטוס" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הסטטוסים</SelectItem>
                    {Object.entries(STATUS_MAP).filter(([k]) => k !== 'gmail_inbox').map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">טווח תאריכים:</span>
                <Input type="month" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 rounded-xl" />
                <span className="text-muted-foreground text-sm">—</span>
                <Input type="month" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 rounded-xl" />
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
                    <TableHead className="text-right">סטטוס</TableHead>
                    {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">לא נמצאו הוצאות</TableCell></TableRow>
                  ) : filtered.map(expense => {
                    const status = STATUS_MAP[expense.status] || STATUS_MAP.pending_approval;
                    const scopeLabel = expense.scope === 'agent' ? 'סוכן' : expense.scope === 'deal' ? 'עסקה' : 'משרד';
                    return (
                      <TableRow key={expense.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setViewExpense(expense)}>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => setEditExpense(expense)}><Pencil className="w-4 h-4 ml-2" /> עריכה</DropdownMenuItem>
                              {isAdminView && expense.status !== 'approved' && (
                                <DropdownMenuItem onClick={() => approveMutation.mutate(expense.id)}>
                                  <CheckCircle className="w-4 h-4 ml-2 text-emerald-600" /> אישור
                                </DropdownMenuItem>
                              )}
                              {expense.receipt_url && (
                                <DropdownMenuItem onClick={() => window.open(expense.receipt_url, '_blank')}>
                                  <Download className="w-4 h-4 ml-2" /> פתח קבלה
                                </DropdownMenuItem>
                              )}
                              {isAdminView && (
                                <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`למחוק את ההוצאה "${expense.vendor_name}"? פעולה זו אינה ניתנת לביטול.`)) deleteMutation.mutate(expense.id); }}>
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
                        <TableCell className="text-right"><Badge variant="secondary" className={`text-xs ${status.color}`}>{status.label}</Badge></TableCell>
                        {isAdminView && <TableCell className="text-sm text-muted-foreground text-right">{expense.agent_name || '-'}</TableCell>}
                        <TableCell className="text-sm text-right">{expense.category || '-'}</TableCell>
                        <TableCell className="font-semibold text-sm text-right">{formatCurrency(expense.total_amount, expense.currency)}</TableCell>
                        <TableCell className="font-medium text-sm text-right">{expense.vendor_name || '-'}</TableCell>
                        <TableCell className="text-sm text-right">{expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
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

        {/* ── הוצאות קבועות Tab ── */}
        <TabsContent value="recurring" className="mt-4">
          <RecurringExpensesTab />
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
                  ['סכום כולל', formatCurrency(viewExpense.total_amount, viewExpense.currency)],
                  ['לפני מע״מ', viewExpense.amount_before_vat ? formatCurrency(viewExpense.amount_before_vat) : '-'],
                  ['קטגוריה', viewExpense.category || '-'],
                  ['שיוך', viewExpense.scope === 'agent' ? 'סוכן' : viewExpense.scope === 'deal' ? 'עסקה' : 'משרד'],
                  ['סוכן', viewExpense.agent_name || '-'],
                  ['אמצעי תשלום', PAYMENT_METHODS[viewExpense.payment_method] || '-'],
                ].map(([label, value]) => (
                  <div key={label}><p className="text-muted-foreground text-xs">{label}</p><p className="font-medium">{value}</p></div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                {isAdminView && viewExpense.status !== 'approved' && (
                  <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => { approveMutation.mutate(viewExpense.id); setViewExpense(null); }}>
                    <CheckCircle className="w-4 h-4 ml-2" /> אשר הוצאה
                  </Button>
                )}
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

      {/* Receipt upload + review dialog */}
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
