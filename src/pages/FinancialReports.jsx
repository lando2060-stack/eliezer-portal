import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatCurrency, DEAL_STATUS_MAP } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  BookOpen, TrendingUp, TrendingDown, DollarSign, Percent,
  Download, Printer,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const formatShort = (v) => `₪${(v / 1000).toFixed(0)}k`;

const THIS_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;


function KpiCard({ label, value, sub, icon: Icon, color }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinancialReports() {
  const printRef = useRef(null);
  const [dateFrom, setDateFrom] = useState(THIS_MONTH);
  const [dateTo, setDateTo]     = useState(THIS_MONTH);
  const [agentFilter, setAgentFilter] = useState('all');

  const { data: agents   = [] } = useQuery({ queryKey: ['agents'],   queryFn: () => base44.entities.Agent.list() });
  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'],    queryFn: () => base44.entities.Deal.list('-created_date', 500) });
  const { data: allExpenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 500) });

  const inRange = (month) => {
    if (!month) return false;
    if (dateFrom && month < dateFrom) return false;
    if (dateTo   && month > dateTo)   return false;
    return true;
  };

  const inDateRange = (dateStr) => {
    if (!dateStr) return false;
    const m = dateStr.slice(0, 7);
    if (dateFrom && m < dateFrom) return false;
    if (dateTo   && m > dateTo)   return false;
    return true;
  };

  const deals = useMemo(() => {
    let d = allDeals.filter(x => inRange(x.month));
    if (agentFilter !== 'all') d = d.filter(x => x.agent_id === agentFilter);
    return d;
  }, [allDeals, dateFrom, dateTo, agentFilter]);

  const expenses = useMemo(() => {
    let e = allExpenses.filter(x => inDateRange(x.date));
    if (agentFilter !== 'all') e = e.filter(x => x.agent_id === agentFilter);
    return e;
  }, [allExpenses, dateFrom, dateTo, agentFilter]);

  // ── KPIs ─────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalComm    = deals.reduce((s, d) => s + (d.commission_amount || 0), 0);
    const officeComm   = deals.reduce((s, d) => s + (d.office_commission || 0), 0);
    const agentComm    = deals.reduce((s, d) => s + (d.agent_commission || 0), 0);
    const collected    = deals.reduce((s, d) => s + (d.collected_actual || 0), 0);
    const totalExp     = expenses.filter(e => e.status !== 'rejected').reduce((s, e) => s + (e.total_amount || 0), 0);
    const netProfit    = officeComm - totalExp;
    const collectionRate = totalComm > 0 ? Math.round((collected / totalComm) * 100) : 0;
    return { totalComm, officeComm, agentComm, collected, totalExp, netProfit, collectionRate };
  }, [deals, expenses]);

  // ── Monthly chart ────────────────────────────────────────
  const monthlyChart = useMemo(() => {
    const months = new Set([
      ...allDeals.map(d => d.month).filter(Boolean),
      ...allExpenses.map(e => e.date?.slice(0, 7)).filter(Boolean),
    ]);
    return [...months].sort().filter(m => {
      if (dateFrom && m < dateFrom) return false;
      if (dateTo   && m > dateTo)   return false;
      return true;
    }).map(m => {
      const mDeals = deals.filter(d => d.month === m);
      const mExp   = expenses.filter(e => e.date?.slice(0, 7) === m && e.status !== 'rejected');
      return {
        month: m.slice(5),
        הכנסות: Math.round(mDeals.reduce((s, d) => s + (d.office_commission || 0), 0)),
        הוצאות: Math.round(mExp.reduce((s, e) => s + (e.total_amount || 0), 0)),
      };
    });
  }, [deals, expenses, dateFrom, dateTo]);

  // ── Per-agent table ──────────────────────────────────────
  const agentRows = useMemo(() => {
    return agents
      .map(a => {
        const ad = deals.filter(d => d.agent_id === a.id);
        const ae = expenses.filter(e => e.agent_id === a.id && e.status !== 'rejected');
        return {
          id: a.id,
          name: a.name,
          deals: ad.length,
          commission: ad.reduce((s, d) => s + (d.commission_amount || 0), 0),
          agentComm: ad.reduce((s, d) => s + (d.agent_commission || 0), 0),
          officeComm: ad.reduce((s, d) => s + (d.office_commission || 0), 0),
          collected: ad.reduce((s, d) => s + (d.collected_actual || 0), 0),
          expenses: ae.reduce((s, e) => s + (e.total_amount || 0), 0),
        };
      })
      .filter(r => r.deals > 0 || r.expenses > 0);
  }, [agents, deals, expenses]);

  // ── Expense categories ───────────────────────────────────
  const categoryRows = useMemo(() => {
    const map = {};
    expenses.filter(e => e.status !== 'rejected').forEach(e => {
      const cat = e.category || 'אחר';
      map[cat] = (map[cat] || 0) + (e.total_amount || 0);
    });
    return Object.entries(map)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // ── Agent bar chart ──────────────────────────────────────
  const agentChart = useMemo(() =>
    agentRows.map(r => ({
      name: r.name.split(' ')[0],
      'עמלת משרד': Math.round(r.officeComm),
      הוצאות: Math.round(r.expenses),
    })),
    [agentRows]
  );

  // ── Excel export ─────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: summary KPIs
    const summaryData = [
      ['מדד', 'ערך'],
      ['סה"כ עמלות', kpi.totalComm],
      ['עמלת משרד', kpi.officeComm],
      ['עמלת סוכנים', kpi.agentComm],
      ['סה"כ נגבה', kpi.collected],
      ['אחוז גביה', `${kpi.collectionRate}%`],
      ['סה"כ הוצאות', kpi.totalExp],
      ['רווח נקי', kpi.netProfit],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'סיכום');

    // Sheet 2: per-agent
    const agentData = [
      ['סוכן', 'עסקאות', 'סה"כ עמלות', 'עמלת משרד', 'עמלת סוכן', 'נגבה', 'הוצאות'],
      ...agentRows.map(r => [r.name, r.deals, r.commission, r.officeComm, r.agentComm, r.collected, r.expenses]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(agentData), 'לפי סוכן');

    // Sheet 3: monthly
    const monthlyData = [
      ['חודש', 'הכנסות (עמלת משרד)', 'הוצאות'],
      ...monthlyChart.map(r => [r.month, r.הכנסות, r.הוצאות]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyData), 'לפי חודש');

    // Sheet 4: expenses by category
    const catData = [
      ['קטגוריה', 'סכום'],
      ...categoryRows.map(r => [r.cat, r.total]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catData), 'הוצאות לפי קטגוריה');

    XLSX.writeFile(wb, `דוחות_${dateFrom || 'כל'}_${dateTo || 'הזמנים'}.xlsx`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 print:space-y-4" ref={printRef}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> דוחות כספיים
        </h1>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue placeholder="כל הסוכנים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוכנים</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">טווח תאריכים:</span>
            <Input type="month" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 rounded-xl" />
            <span className="text-muted-foreground text-sm">—</span>
            <Input type="month" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 rounded-xl" />
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5 rounded-xl">
                <Download className="w-4 h-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 rounded-xl">
                <Printer className="w-4 h-4" /> הדפסה
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="עמלות משרד (הכנסות)" value={formatCurrency(kpi.officeComm)}
          sub={`${deals.length} עסקאות`} icon={TrendingUp} color="bg-emerald-100 text-emerald-600" />
        <KpiCard label="סה״כ הוצאות" value={formatCurrency(kpi.totalExp)}
          sub={`${expenses.length} רשומות`} icon={TrendingDown} color="bg-red-100 text-red-600" />
        <KpiCard label="רווח נקי" value={formatCurrency(kpi.netProfit)}
          sub={kpi.netProfit >= 0 ? 'רווח' : 'הפסד'}
          icon={DollarSign}
          color={kpi.netProfit >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'} />
        <KpiCard label="אחוז גביה" value={`${kpi.collectionRate}%`}
          sub={`${formatCurrency(kpi.collected)} נגבה`} icon={Percent} color="bg-purple-100 text-purple-600" />
      </div>

      {/* Monthly chart */}
      {monthlyChart.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4">הכנסות מול הוצאות — לפי חודש</h2>
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyChart} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatShort} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="הכנסות" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="הוצאות" fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-agent chart */}
      {agentChart.length > 1 && agentFilter === 'all' && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4">עמלת משרד לעומת הוצאות — לפי סוכן</h2>
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentChart} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatShort} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="עמלת משרד" fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="הוצאות"    fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-agent table */}
      {agentRows.length > 0 && (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="px-5 pt-4 pb-3 border-b">
              <h2 className="font-semibold">ריכוז לפי סוכן</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">סוכן</TableHead>
                    <TableHead className="text-right">עסקאות</TableHead>
                    <TableHead className="text-right">סה״כ עמלות</TableHead>
                    <TableHead className="text-right">עמלת משרד</TableHead>
                    <TableHead className="text-right">עמלת סוכן</TableHead>
                    <TableHead className="text-right">נגבה</TableHead>
                    <TableHead className="text-right">הוצאות</TableHead>
                    <TableHead className="text-right">מאזן</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentRows.map(r => {
                    const balance = r.officeComm - r.expenses;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.name}</TableCell>
                        <TableCell className="text-sm">{r.deals}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(r.commission)}</TableCell>
                        <TableCell className="text-sm text-primary">{formatCurrency(r.officeComm)}</TableCell>
                        <TableCell className="text-sm text-emerald-700">{formatCurrency(r.agentComm)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(r.collected)}</TableCell>
                        <TableCell className="text-sm text-red-600">{formatCurrency(r.expenses)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary"
                            className={`text-xs font-semibold ${balance >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                            {formatCurrency(balance)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell className="text-sm font-bold">סה״כ</TableCell>
                    <TableCell className="text-sm">{agentRows.reduce((s,r)=>s+r.deals,0)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(agentRows.reduce((s,r)=>s+r.commission,0))}</TableCell>
                    <TableCell className="text-sm text-primary">{formatCurrency(kpi.officeComm)}</TableCell>
                    <TableCell className="text-sm text-emerald-700">{formatCurrency(kpi.agentComm)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(kpi.collected)}</TableCell>
                    <TableCell className="text-sm text-red-600">{formatCurrency(kpi.totalExp)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary"
                        className={`text-xs font-semibold ${kpi.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                        {formatCurrency(kpi.netProfit)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expense categories table */}
      {categoryRows.length > 0 && (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="px-5 pt-4 pb-3 border-b">
              <h2 className="font-semibold">הוצאות לפי קטגוריה</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">% מסה״כ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRows.map(r => (
                    <TableRow key={r.cat}>
                      <TableCell className="font-medium text-sm">{r.cat}</TableCell>
                      <TableCell className="text-sm text-red-600">{formatCurrency(r.total)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {kpi.totalExp > 0 ? `${Math.round((r.total / kpi.totalExp) * 100)}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {deals.length === 0 && expenses.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">אין נתונים בתקופה הנבחרת</div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { direction: rtl; }
        }
      `}</style>
    </div>
  );
}
