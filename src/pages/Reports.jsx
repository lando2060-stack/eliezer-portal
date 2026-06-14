import React, { useState, useMemo, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, TrendingUp, FileText, DollarSign, Loader2, Wallet, Search, MoreVertical, Pencil, Trash2, Save, FileSpreadsheet } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/csv';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import AddPaymentDialog from '@/components/deals/AddPaymentDialog';
import ExcelImportDialog from '@/components/ExcelImportDialog';

const PAYMENT_METHODS = ['מזומן', 'שיק', 'העברה בנקאית', 'כרטיס אשראי', 'ביט', 'פייפאל', 'אחר'];

const THIS_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const THIS_YEAR = String(new Date().getFullYear());

// ── KPI Card ───────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
        <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { user } = useCurrentUser();
  const isAdminView = useIsAdminView();
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [filterMode, setFilterMode] = useState('month');
  const [filterMonth, setFilterMonth] = useState(THIS_MONTH);
  const [filterFromMonth, setFilterFromMonth] = useState(THIS_MONTH);
  const [filterToMonth, setFilterToMonth] = useState(THIS_MONTH);
  const [filterYear, setFilterYear] = useState(THIS_YEAR);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [editForm, setEditForm] = useState({});
  const reportRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (location.state?.openPicker) {
      setPickerOpen(true);
      // Clear the state so back-navigation doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.openPicker]);

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 500) });
  const { data: allPayments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list('-date', 500) });

  const myAgent = agents.find(a => a.user_id === user?.id);

  const openEdit = (p) => {
    setEditPayment(p);
    setEditForm({ amount: p.amount?.toString() ?? '', date: p.date ?? '', payment_method: p.payment_method ?? '', notes: p.notes ?? '' });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(editForm.amount) || 0;
      await base44.entities.Payment.update(editPayment.id, {
        amount, date: editForm.date, payment_method: editForm.payment_method, notes: editForm.notes,
      });
      const allP = await base44.entities.Payment.filter({ deal_id: editPayment.deal_id });
      const newCollected = allP.reduce((s, p) => s + (p.amount || 0), 0);
      await base44.entities.Deal.update(editPayment.deal_id, { collected_actual: newCollected });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('ההכנסה עודכנה');
      setEditPayment(null);
    },
    onError: () => toast.error('שגיאה בעדכון'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (p) => {
      await base44.entities.Payment.delete(p.id);
      const allP = await base44.entities.Payment.filter({ deal_id: p.deal_id });
      const newCollected = allP.reduce((s, x) => s + (x.amount || 0), 0);
      await base44.entities.Deal.update(p.deal_id, { collected_actual: newCollected });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('ההכנסה נמחקה');
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  // For non-admin: filter by deals belonging to the agent
  const myDealIds = useMemo(() => {
    if (!myAgent) return new Set();
    return new Set(allDeals.filter(d => d.agent_id === myAgent.id).map(d => d.id));
  }, [allDeals, myAgent]);

  const matchesDate = (dateStr) => {
    if (!dateStr) return false;
    const m = dateStr.slice(0, 7);
    const y = dateStr.slice(0, 4);
    if (filterMode === 'month') return m === filterMonth;
    if (filterMode === 'range') return m >= filterFromMonth && m <= filterToMonth;
    if (filterMode === 'year') return y === filterYear;
    return true;
  };

  const availableYears = useMemo(() => {
    const years = [...new Set(allPayments.map(p => p.date?.slice(0, 4)).filter(Boolean))].sort().reverse();
    if (!years.includes(THIS_YEAR)) years.unshift(THIS_YEAR);
    return years;
  }, [allPayments]);

  const payments = useMemo(() => {
    let p = allPayments;
    if (!isAdminView) p = p.filter(x => myDealIds.has(x.deal_id));
    if (isAdminView && selectedAgent !== 'all') p = p.filter(x => x.agent_id === selectedAgent);
    return p.filter(x => matchesDate(x.date));
  }, [allPayments, isAdminView, myDealIds, selectedAgent, filterMode, filterMonth, filterFromMonth, filterToMonth, filterYear]);

  const filteredPayments = useMemo(() => {
    if (!search) return payments;
    const q = search.toLowerCase();
    return payments.filter(p =>
      p.deal_client_name?.toLowerCase().includes(q) ||
      p.deal_address?.toLowerCase().includes(q) ||
      p.agent_name?.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const totalAmount = useMemo(() => filteredPayments.reduce((s, p) => s + (p.amount || 0), 0), [filteredPayments]);

  // Deals available for picker (non-cancelled, scoped to agent if not admin)
  const pickerDeals = useMemo(() => {
    let d = allDeals.filter(x => x.status !== 'בוטלה');
    if (!isAdminView && myAgent) d = d.filter(x => x.agent_id === myAgent.id);
    if (pickerSearch) {
      const q = pickerSearch.toLowerCase();
      d = d.filter(x => x.client_name?.toLowerCase().includes(q) || x.address?.toLowerCase().includes(q));
    }
    return d;
  }, [allDeals, isAdminView, myAgent, pickerSearch]);

  const exportCSV = () => {
    const label = filterMode === 'year' ? filterYear : filterMode === 'month' ? filterMonth : `${filterFromMonth}_${filterToMonth}`;
    downloadCSV(`הכנסות_${label}.csv`, filteredPayments, {
      date: 'תאריך', deal_client_name: 'לקוח', deal_address: 'כתובת',
      amount: 'סכום', payment_method: 'אמצעי תשלום', agent_name: 'סוכן', notes: 'הערות',
    });
    toast.success('יוצא בהצלחה');
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgW, imgH);
      const label = filterMode === 'year' ? filterYear : filterMode === 'month' ? filterMonth : `${filterFromMonth}_${filterToMonth}`;
      pdf.save(`הכנסות_${label}.pdf`);
      toast.success('הדוח יוצא בהצלחה');
    } catch { toast.error('שגיאה בייצוא'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Header */}
      <div className="flex items-center flex-wrap gap-3">
        <div className="me-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> הכנסות
          </h1>
          <p className="text-muted-foreground text-sm mt-1">תשלומים שהתקבלו בפועל מעסקאות</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setShowImport(true)}>
          <FileSpreadsheet className="w-4 h-4" /> ייבוא מאקסל
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Excel
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportPDF} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="סה״כ נגבה" value={formatCurrency(totalAmount)} icon={TrendingUp} color="bg-emerald-100 text-emerald-600" />
        <KpiCard label="מספר הכנסות" value={filteredPayments.length} icon={FileText} color="bg-blue-100 text-blue-600" />
        <KpiCard
          label="ממוצע הכנסה"
          value={filteredPayments.length ? formatCurrency(Math.round(totalAmount / filteredPayments.length)) : '—'}
          icon={DollarSign}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Filters + export */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
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
              <Input placeholder="חיפוש לקוח, כתובת, סוכן..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
            </div>
            {isAdminView && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
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

      {/* Payments table */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">כתובת</TableHead>
                {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                <TableHead className="text-right">סכום שהתקבל</TableHead>
                <TableHead className="text-right">אמצעי תשלום</TableHead>
                <TableHead className="text-right">הערות</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdminView ? 8 : 7} className="text-center py-12 text-muted-foreground">
                    אין הכנסות בתקופה זו
                  </TableCell>
                </TableRow>
              ) : filteredPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.date ? format(new Date(p.date), 'dd/MM/yy') : '-'}</TableCell>
                  <TableCell className="font-medium text-sm">{p.deal_client_name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.deal_address || '-'}</TableCell>
                  {isAdminView && <TableCell className="text-sm text-muted-foreground">{p.agent_name || '-'}</TableCell>}
                  <TableCell className="text-sm font-semibold text-emerald-700">{formatCurrency(p.amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.payment_method || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.notes || '-'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="w-4 h-4 ml-2" /> עריכה</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm('למחוק הכנסה זו?')) deleteMutation.mutate(p); }}><Trash2 className="w-4 h-4 ml-2" /> מחיקה</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Deal Picker Dialog */}
      {pickerOpen && (
        <Dialog open onOpenChange={() => { setPickerOpen(false); setPickerSearch(''); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>בחר עסקה להוספת הכנסה</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי לקוח / כתובת..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                className="pr-9 rounded-xl"
              />
            </div>
            <div className="space-y-2 overflow-y-auto max-h-80 mt-1">
              {pickerDeals.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">לא נמצאו עסקאות</p>
              ) : pickerDeals.map(d => (
                <button
                  key={d.id}
                  className="w-full text-right p-3 rounded-xl hover:bg-muted transition-colors border"
                  onClick={() => { setSelectedDeal(d); setPickerOpen(false); setPickerSearch(''); }}
                >
                  <p className="font-medium text-sm">{d.client_name}</p>
                  <p className="text-xs text-muted-foreground">{[d.address, d.month].filter(Boolean).join(' • ')}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    נגבה: {formatCurrency(d.collected_actual)} מתוך {formatCurrency(d.commission_amount)} עמלה
                  </p>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedDeal && (
        <AddPaymentDialog
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}

      {showImport && (
        <ExcelImportDialog
          type="payments"
          agents={agents}
          deals={allDeals}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Edit Payment Dialog */}
      {editPayment && (
        <Dialog open onOpenChange={() => setEditPayment(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>עריכת הכנסה — {editPayment.deal_client_name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">סכום שהתקבל ₪ *</Label>
                <Input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">תאריך קבלה</Label>
                <Input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">אמצעי תשלום</Label>
                <Select value={editForm.payment_method} onValueChange={v => setEditForm(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">הערות</Label>
                <Textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <Button className="w-full rounded-xl gap-2" onClick={() => updateMutation.mutate()} disabled={!editForm.amount || updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                שמור שינויים
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
