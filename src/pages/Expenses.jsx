import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Pencil, Trash2, Upload, Plus, CheckCircle, Download, PenLine, Mail, Loader2, Eye, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { formatCurrency, STATUS_MAP, PAYMENT_METHODS } from '@/lib/constants';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import { supabase } from '@/lib/supabase';
import ExpenseEditDialog from '@/components/expenses/ExpenseEditDialog';

// ── Gmail Inbox Tab ───────────────────────────────────────────
function GmailInboxTab({ inboxExpenses, isLoading, onDelete, onExtracted }) {
  const [extractingId, setExtractingId] = useState(null);
  const [previewExpense, setPreviewExpense] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const handleExtract = async (expense) => {
    if (!expense.receipt_url) { toast.error('אין קובץ מצורף'); return; }
    setExtractingId(expense.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          file_url: expense.receipt_url,
          json_schema: {
            type: 'object',
            properties: {
              vendor_name: { type: 'string' },
              vendor_tax_id: { type: 'string' },
              date: { type: 'string', description: 'YYYY-MM-DD' },
              receipt_number: { type: 'string' },
              invoice_number: { type: 'string' },
              total_amount: { type: 'number' },
              amount_before_vat: { type: 'number' },
              vat_amount: { type: 'number' },
              payment_method: { type: 'string' },
              currency: { type: 'string' },
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.error || 'שגיאה בחילוץ');
      setExtracted({ ...data.output, id: expense.id, receipt_url: expense.receipt_url });
      setPreviewExpense(expense);
      setConfirmOpen(true);
    } catch (err) {
      toast.error(err.message || 'שגיאה בחילוץ פרטים');
    } finally {
      setExtractingId(null);
    }
  };

  const confirmMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Expense.update(data.id, {
        vendor_name: data.vendor_name || '',
        vendor_tax_id: data.vendor_tax_id || '',
        date: data.date || '',
        receipt_number: data.receipt_number || '',
        invoice_number: data.invoice_number || '',
        total_amount: parseFloat(data.total_amount) || 0,
        amount_before_vat: parseFloat(data.amount_before_vat) || 0,
        vat_amount: parseFloat(data.vat_amount) || 0,
        payment_method: data.payment_method || '',
        currency: data.currency || 'ILS',
        status: 'pending_approval',
        has_receipt: true,
        notes: '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('הפרטים נשמרו — ההוצאה הועברה לאישור');
      setConfirmOpen(false);
      setExtracted(null);
      setPreviewExpense(null);
      onExtracted?.();
    },
    onError: () => toast.error('שגיאה בשמירת הפרטים'),
  });

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
                    {expense.receipt_url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(expense.receipt_url, '_blank')}>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl text-xs bg-violet-600 hover:bg-violet-700"
                      onClick={() => handleExtract(expense)}
                      disabled={extractingId === expense.id}
                    >
                      {extractingId === expense.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Sparkles className="w-3.5 h-3.5" />}
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

      {/* Confirm extraction dialog */}
      <Dialog open={confirmOpen} onOpenChange={v => { if (!v) { setConfirmOpen(false); setExtracted(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-600" /> פרטים שחולצו</DialogTitle></DialogHeader>
          {extracted && (
            <div className="space-y-4">
              {previewExpense?.receipt_url && (
                <div className="bg-muted rounded-xl overflow-hidden">
                  <img src={previewExpense.receipt_url} alt="חשבונית" className="w-full max-h-48 object-contain" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">ניתן לערוך לפני השמירה</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['vendor_name', 'שם ספק'],
                  ['vendor_tax_id', 'ח.פ.'],
                  ['date', 'תאריך'],
                  ['receipt_number', 'מספר קבלה'],
                  ['invoice_number', 'מספר חשבונית'],
                  ['total_amount', 'סכום כולל'],
                  ['amount_before_vat', 'לפני מע״מ'],
                  ['vat_amount', 'מע״מ'],
                  ['payment_method', 'אמצעי תשלום'],
                  ['currency', 'מטבע'],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={extracted[key] ?? ''}
                      onChange={e => setExtracted(prev => ({ ...prev, [key]: e.target.value }))}
                      className="rounded-xl text-sm h-8"
                    />
                  </div>
                ))}
              </div>
              <Button
                className="w-full rounded-xl gap-2 bg-violet-600 hover:bg-violet-700"
                onClick={() => confirmMutation.mutate(extracted)}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                שמור והעבר לאישור
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Expenses Page ────────────────────────────────────────
export default function Expenses() {
  const { user } = useCurrentUser();
  const isAdminView = useIsAdminView();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
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
    return matchSearch && matchStatus;
  }), [expenses, search, statusFilter]);

  const totalFiltered = filtered.reduce((s, e) => s + (e.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="me-auto">
          <h1 className="text-2xl font-bold">קבלות והוצאות</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} הוצאות • סה״כ {formatCurrency(totalFiltered)}</p>
        </div>
        <Button className="gap-2 rounded-xl" onClick={() => setShowAddModal(true)}>
          הוצאה חדשה <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="rounded-xl">
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
            <CardContent className="p-4">
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
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">שיוך</TableHead>
                    {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">קבלה</TableHead>
                    <TableHead className="w-12"></TableHead>
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
                        <TableCell className="text-sm">{expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{expense.vendor_name || '-'}</TableCell>
                        <TableCell className="text-sm">{expense.category || '-'}</TableCell>
                        <TableCell className="font-semibold text-sm">{formatCurrency(expense.total_amount, expense.currency)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{scopeLabel}</Badge></TableCell>
                        {isAdminView && <TableCell className="text-sm text-muted-foreground">{expense.agent_name || '-'}</TableCell>}
                        <TableCell><Badge variant="secondary" className={`text-xs ${status.color}`}>{status.label}</Badge></TableCell>
                        <TableCell>
                          {expense.has_receipt
                            ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">יש</Badge>
                            : <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">חסרה</Badge>}
                        </TableCell>
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
            onExtracted={() => {}}
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
            <Link to="/upload" onClick={() => setShowAddModal(false)}>
              <button className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-right">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Upload className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold">העלאת מסמך</p>
                  <p className="text-xs text-muted-foreground">תמונה או PDF עם סריקה אוטומטית</p>
                </div>
              </button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
