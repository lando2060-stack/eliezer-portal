import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, TrendingDown, DollarSign, FileText, Loader2, Wallet } from 'lucide-react';
import { formatCurrency, DEAL_STATUS_MAP, STATUS_MAP } from '@/lib/constants';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/csv';
import { format } from 'date-fns';

// ── Date filtering ─────────────────────────────────────────
const DATE_PRESETS = [
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'החודש הקודם' },
  { value: 'this_quarter', label: 'הרבעון הנוכחי' },
  { value: 'last_quarter', label: 'הרבעון הקודם' },
  { value: 'this_year', label: 'השנה הנוכחית' },
  { value: 'last_year', label: 'השנה הקודמת' },
  { value: 'all', label: 'כל התקופות' },
  { value: 'custom', label: 'טווח מותאם' },
];

function getPresetMonths(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const fmt = (yr, mo) => `${yr}-${String(mo).padStart(2, '0')}`;
  const quarter = Math.ceil(m / 3);
  switch (preset) {
    case 'this_month': return [fmt(y, m)];
    case 'last_month': return m === 1 ? [fmt(y - 1, 12)] : [fmt(y, m - 1)];
    case 'this_quarter': return Array.from({ length: 3 }, (_, i) => fmt(y, (quarter - 1) * 3 + 1 + i));
    case 'last_quarter': {
      const lq = quarter === 1 ? 4 : quarter - 1;
      const ly = quarter === 1 ? y - 1 : y;
      return Array.from({ length: 3 }, (_, i) => fmt(ly, (lq - 1) * 3 + 1 + i));
    }
    case 'this_year': return Array.from({ length: 12 }, (_, i) => fmt(y, i + 1));
    case 'last_year': return Array.from({ length: 12 }, (_, i) => fmt(y - 1, i + 1));
    default: return null;
  }
}

function filterByDate(items, dateField, preset, customFrom, customTo) {
  if (preset === 'all') return items;
  if (preset === 'custom') {
    return items.filter(x => {
      const v = x[dateField];
      if (!v) return false;
      const d = v.slice(0, 7); // YYYY-MM
      if (customFrom && d < customFrom) return false;
      if (customTo && d > customTo) return false;
      return true;
    });
  }
  const months = getPresetMonths(preset);
  return items.filter(x => {
    const v = x[dateField];
    if (!v) return false;
    return months.includes(v.slice(0, 7));
  });
}

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
  const [datePreset, setDatePreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 500) });
  const { data: allExpenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 500) });

  const myAgent = agents.find(a => a.user_id === user?.id);

  // ── הכנסות (deals) ───────────────────────────────────────
  const deals = useMemo(() => {
    let d = allDeals;
    if (!isAdminView) d = d.filter(x => x.agent_id === myAgent?.id);
    if (selectedAgent !== 'all') d = d.filter(x => x.agent_id === selectedAgent);
    // filter by month field
    if (datePreset === 'all') return d;
    if (datePreset === 'custom') {
      return d.filter(x => {
        if (!x.month) return false;
        if (customFrom && x.month < customFrom) return false;
        if (customTo && x.month > customTo) return false;
        return true;
      });
    }
    const months = getPresetMonths(datePreset);
    return d.filter(x => months?.includes(x.month));
  }, [allDeals, isAdminView, myAgent, selectedAgent, datePreset, customFrom, customTo]);

  // ── הוצאות ───────────────────────────────────────────────
  const expenses = useMemo(() => {
    let e = allExpenses;
    if (!isAdminView) e = e.filter(x => x.agent_id === myAgent?.id || x.created_by_id === user?.id);
    if (isAdminView && selectedAgent !== 'all') e = e.filter(x => x.agent_id === selectedAgent);
    return filterByDate(e, 'date', datePreset, customFrom, customTo);
  }, [allExpenses, isAdminView, user?.id, myAgent, selectedAgent, datePreset, customFrom, customTo]);

  // ── KPIs ─────────────────────────────────────────────────
  const incomeStats = useMemo(() => ({
    totalCommission: deals.reduce((s, d) => s + (d.commission_amount || 0), 0),
    totalCollected: deals.reduce((s, d) => s + (d.collected_actual || 0), 0),
    totalAgentComm: deals.reduce((s, d) => s + (d.agent_commission || 0), 0),
    totalOfficeComm: deals.reduce((s, d) => s + (d.office_commission || 0), 0),
  }), [deals]);

  const expenseStats = useMemo(() => ({
    total: expenses.reduce((s, e) => s + (e.total_amount || 0), 0),
    pending: expenses.filter(e => e.status === 'pending_approval').length,
    approved: expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.total_amount || 0), 0),
  }), [expenses]);

  const netProfit = incomeStats.totalOfficeComm - expenseStats.total;

  // ── Exports ──────────────────────────────────────────────
  const exportDealsCSV = () => {
    downloadCSV(`הכנסות_${datePreset}.csv`, deals, {
      month: 'חודש', client_name: 'לקוח', agent_name: 'סוכן',
      commission_amount: 'עמלה', collected_actual: 'נגבה',
      agent_commission: 'עמלת סוכן', office_commission: 'עמלת משרד', status: 'סטטוס',
    });
    toast.success('יוצא בהצלחה');
  };

  const exportExpensesCSV = () => {
    downloadCSV(`הוצאות_${datePreset}.csv`, expenses, {
      date: 'תאריך', vendor_name: 'ספק', category: 'קטגוריה',
      total_amount: 'סכום', payment_method: 'אמצעי תשלום',
      agent_name: 'סוכן', status: 'סטטוס',
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
      pdf.save(`הכנסות_${datePreset}.pdf`);
      toast.success('הדוח יוצא בהצלחה');
    } catch { toast.error('שגיאה בייצוא'); }
    finally { setExporting(false); }
  };

  // ── Shared filters bar ───────────────────────────────────
  const FiltersBar = ({ onExportCSV }) => (
    <div className="flex gap-2 flex-wrap">
      {isAdminView && (
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="כל הסוכנים" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוכנים</SelectItem>
            {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={datePreset} onValueChange={setDatePreset}>
        <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {datePreset === 'custom' && (
        <>
          <Input type="month" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-32 rounded-xl" />
          <Input type="month" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-32 rounded-xl" />
        </>
      )}
      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={onExportCSV}>
        <Download className="w-4 h-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportPDF} disabled={exporting}>
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
      </Button>
    </div>
  );

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Header + summary KPIs */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" /> הכנסות
        </h1>
        <p className="text-muted-foreground text-sm mt-1">הכנסות והוצאות בתקופה הנבחרת</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="סה״כ עמלות" value={formatCurrency(incomeStats.totalCommission)} icon={TrendingUp} color="bg-emerald-100 text-emerald-600" />
        <KpiCard label="סה״כ הוצאות" value={formatCurrency(expenseStats.total)} icon={TrendingDown} color="bg-red-100 text-red-600" />
        <KpiCard label={isAdminView ? 'רווח משרד' : 'עמלה שלי'} value={formatCurrency(isAdminView ? incomeStats.totalOfficeComm : incomeStats.totalAgentComm)} icon={DollarSign} color="bg-blue-100 text-blue-600" />
        {isAdminView
          ? <KpiCard label="רווח נקי (משוער)" value={formatCurrency(netProfit)} icon={Wallet} color={netProfit >= 0 ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'} />
          : <KpiCard label="הוצאות ממתינות" value={expenseStats.pending} icon={FileText} color="bg-amber-100 text-amber-600" />
        }
      </div>

      {/* Tabs */}
      <Tabs defaultValue="income">
        <TabsList className="rounded-xl">
          <TabsTrigger value="income" className="gap-2 rounded-lg">
            <TrendingUp className="w-4 h-4" /> הכנסות ({deals.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2 rounded-lg">
            <TrendingDown className="w-4 h-4" /> הוצאות ({expenses.length})
          </TabsTrigger>
        </TabsList>

        {/* ── הכנסות Tab ── */}
        <TabsContent value="income" className="mt-4 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              עמלות: <strong>{formatCurrency(incomeStats.totalCommission)}</strong> •
              נגבה: <strong>{formatCurrency(incomeStats.totalCollected)}</strong>
              {isAdminView && <> • משרד: <strong>{formatCurrency(incomeStats.totalOfficeComm)}</strong></>}
            </p>
            <FiltersBar onExportCSV={exportDealsCSV} />
          </div>

          <Card className="rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">חודש</TableHead>
                    <TableHead className="text-right">לקוח</TableHead>
                    {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                    <TableHead className="text-right">סכום עסקה</TableHead>
                    <TableHead className="text-right">עמלה</TableHead>
                    <TableHead className="text-right">עמלת סוכן</TableHead>
                    {isAdminView && <TableHead className="text-right">עמלת משרד</TableHead>}
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">אין עסקאות בתקופה זו</TableCell></TableRow>
                  ) : deals.map(d => {
                    const st = DEAL_STATUS_MAP[d.status] || DEAL_STATUS_MAP['פתוחה'];
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{d.month}</TableCell>
                        <TableCell className="font-medium text-sm">{d.client_name}</TableCell>
                        {isAdminView && <TableCell className="text-sm text-muted-foreground">{d.agent_name}</TableCell>}
                        <TableCell className="text-sm">{formatCurrency(d.deal_amount)}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(d.commission_amount)}</TableCell>
                        <TableCell className="text-sm text-emerald-700">{formatCurrency(d.agent_commission)}</TableCell>
                        {isAdminView && <TableCell className="text-sm text-primary">{formatCurrency(d.office_commission)}</TableCell>}
                        <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── הוצאות Tab ── */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              סה״כ: <strong>{formatCurrency(expenseStats.total)}</strong> •
              ממתינות לאישור: <strong className="text-amber-600">{expenseStats.pending}</strong>
            </p>
            <FiltersBar onExportCSV={exportExpensesCSV} />
          </div>

          <Card className="rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">אין הוצאות בתקופה זו</TableCell></TableRow>
                  ) : expenses.map(e => {
                    const st = STATUS_MAP[e.status] || STATUS_MAP.pending_approval;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{e.date ? format(new Date(e.date), 'dd/MM/yy') : '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{e.vendor_name || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.category || '-'}</TableCell>
                        <TableCell className="text-sm font-semibold text-red-600">{formatCurrency(e.total_amount)}</TableCell>
                        {isAdminView && <TableCell className="text-sm text-muted-foreground">{e.agent_name || '-'}</TableCell>}
                        <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
