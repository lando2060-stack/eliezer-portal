import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Pencil, Trash2, Upload, Plus, CheckCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, STATUS_MAP, PAYMENT_METHODS } from '@/lib/constants';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { isAdmin } from '@/lib/roles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import ExpenseEditDialog from '@/components/expenses/ExpenseEditDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Expenses() {
  const { user } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
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

  const expenses = useMemo(() => {
    if (isAdmin(user)) return allExpenses;
    return allExpenses.filter(e => e.agent_id === myAgent?.id || e.created_by_id === user?.id);
  }, [allExpenses, user, myAgent]);

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
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">קבלות והוצאות</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} הוצאות • סה״כ {formatCurrency(totalFiltered)}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/upload">
            <Button className="gap-2 rounded-xl">
              <Upload className="w-4 h-4" /> העלאת קבלה
            </Button>
          </Link>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setEditExpense({})}>
            <Plus className="w-4 h-4" /> הוצאה ידנית
          </Button>
        </div>
      </div>

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
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
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
                {isAdmin(user) && <TableHead className="text-right">סוכן</TableHead>}
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
                    {isAdmin(user) && <TableCell className="text-sm text-muted-foreground">{expense.agent_name || '-'}</TableCell>}
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
                          {isAdmin(user) && expense.status !== 'approved' && (
                            <DropdownMenuItem onClick={() => approveMutation.mutate(expense.id)}>
                              <CheckCircle className="w-4 h-4 ml-2 text-emerald-600" /> אישור
                            </DropdownMenuItem>
                          )}
                          {expense.receipt_url && (
                            <DropdownMenuItem onClick={() => window.open(expense.receipt_url, '_blank')}>
                              <Download className="w-4 h-4 ml-2" /> פתח קבלה
                            </DropdownMenuItem>
                          )}
                          {isAdmin(user) && (
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
                {isAdmin(user) && viewExpense.status !== 'approved' && (
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
    </div>
  );
}