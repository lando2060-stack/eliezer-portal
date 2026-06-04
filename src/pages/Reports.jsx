import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, DollarSign, Users, FileText, Loader2 } from 'lucide-react';
import { formatCurrency, DEAL_STATUS_MAP } from '@/lib/constants';
import { isAdmin } from '@/lib/roles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/csv';

const DATE_PRESETS = [
  { value: 'all', label: 'כל התקופות' },
  { value: 'this_month', label: 'החודש הנוכחי' },
  { value: 'last_month', label: 'החודש הקודם' },
  { value: 'this_quarter', label: 'הרבעון הנוכחי' },
  { value: 'last_quarter', label: 'הרבעון הקודם' },
  { value: 'this_year', label: 'השנה הנוכחית' },
  { value: 'last_year', label: 'השנה הקודמת' },
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
    default: return null; // all or custom
  }
}

export default function Reports() {
  const { user } = useCurrentUser();
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [datePreset, setDatePreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 500) });

  const myAgent = agents.find(a => a.user_id === user?.id);

  const deals = useMemo(() => {
    let d = allDeals;
    if (!isAdmin(user)) d = d.filter(x => x.agent_id === myAgent?.id);
    if (selectedAgent !== 'all') d = d.filter(x => x.agent_id === selectedAgent);
    if (datePreset !== 'all') {
      if (datePreset === 'custom') {
        if (customFrom) d = d.filter(x => x.month >= customFrom);
        if (customTo) d = d.filter(x => x.month <= customTo);
      } else {
        const presetMonths = getPresetMonths(datePreset);
        if (presetMonths) d = d.filter(x => presetMonths.includes(x.month));
      }
    }
    return d;
  }, [allDeals, user, myAgent, selectedAgent, datePreset, customFrom, customTo]);

  const months = useMemo(() => [...new Set(allDeals.map(d => d.month).filter(Boolean))].sort().reverse(), [allDeals]);

  const { totalCommission, totalCollected, totalAgentCommission, totalOfficeCommission } = useMemo(() => ({
    totalCommission: deals.reduce((s, d) => s + (d.commission_amount || 0), 0),
    totalCollected: deals.reduce((s, d) => s + (d.collected_actual || 0), 0),
    totalAgentCommission: deals.reduce((s, d) => s + (d.agent_commission || 0), 0),
    totalOfficeCommission: deals.reduce((s, d) => s + (d.office_commission || 0), 0),
  }), [deals]);

  // Per-agent summary (admin only)
  const agentSummary = useMemo(() => {
    if (!isAdmin(user)) return [];
    const map = {};
    allDeals.forEach(d => {
      if (!d.agent_id) return;
      if (!map[d.agent_id]) map[d.agent_id] = { agent_name: d.agent_name, deals: 0, commission: 0, agent_commission: 0, paid: 0 };
      map[d.agent_id].deals++;
      map[d.agent_id].commission += d.commission_amount || 0;
      map[d.agent_id].agent_commission += d.agent_commission || 0;
      map[d.agent_id].paid += d.paid_to_agent || 0;
    });
    return Object.values(map);
  }, [allDeals, user]);

  const exportCSV = () => {
    const filename = `עסקאות_${selectedMonth !== 'all' ? selectedMonth : 'כולל'}.csv`;
    downloadCSV(filename, deals, {
      month: 'חודש',
      client_name: 'לקוח',
      address: 'כתובת',
      agent_name: 'סוכן',
      deal_amount: 'סכום עסקה',
      commission_amount: 'עמלה',
      collected_actual: 'נגבה',
      agent_commission: 'עמלת סוכן',
      office_commission: 'עמלת משרד',
      paid_to_agent: 'שולם לסוכן',
      status: 'סטטוס',
      payment_method: 'אמצעי תשלום',
    });
    toast.success('הדוח יוצא בהצלחה');
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
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      let yPos = 10;
      let heightLeft = imgH;
      pdf.addImage(imgData, 'PNG', 10, yPos, imgW, imgH);
      heightLeft -= pageH - 20;
      while (heightLeft > 0) {
        yPos = heightLeft - imgH + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, yPos, imgW, imgH);
        heightLeft -= pageH - 20;
      }
      const fileName = `דוח_${datePreset !== 'all' ? datePreset : 'כולל'}.pdf`;
      pdf.save(fileName);
      toast.success('הדוח יוצא בהצלחה');
    } catch {
      toast.error('שגיאה בייצוא הדוח');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">הכנסות ועמלות</h1>
        <div className="flex gap-2 flex-wrap">
          {isAdmin(user) && (
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
              <Input type="month" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36 rounded-xl" placeholder="מ-" />
              <Input type="month" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-36 rounded-xl" placeholder="עד" />
            </>
          )}
          <Button variant="outline" className="gap-2 rounded-xl" onClick={exportCSV}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={exportPDF} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </Button>
        </div>
      </div>

      <div ref={reportRef}>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl"><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">עסקאות</p><p className="text-xl font-bold">{deals.length}</p></div>
          </div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl"><DollarSign className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">סה"כ עמלות</p><p className="text-xl font-bold">{formatCurrency(totalCommission)}</p></div>
          </div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">נגבה בפועל</p><p className="text-xl font-bold">{formatCurrency(totalCollected)}</p></div>
          </div>
        </CardContent></Card>
        {isAdmin(user) ? (
          <Card className="rounded-2xl"><CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl"><Users className="w-5 h-5 text-amber-600" /></div>
              <div><p className="text-xs text-muted-foreground">רווח משרד</p><p className="text-xl font-bold">{formatCurrency(totalOfficeCommission)}</p></div>
            </div>
          </CardContent></Card>
        ) : (
          <Card className="rounded-2xl"><CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl"><DollarSign className="w-5 h-5 text-amber-600" /></div>
              <div><p className="text-xs text-muted-foreground">עמלות שלי</p><p className="text-xl font-bold">{formatCurrency(totalAgentCommission)}</p></div>
            </div>
          </CardContent></Card>
        )}
      </div>

      {/* Admin: agent summary table */}
      {isAdmin(user) && selectedAgent === 'all' && selectedMonth === 'all' && (
        <Card className="rounded-2xl overflow-hidden">
          <CardHeader><CardTitle className="text-base">סיכום לפי סוכן</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">סוכן</TableHead>
                  <TableHead className="text-right">עסקאות</TableHead>
                  <TableHead className="text-right">סה"כ עמלות</TableHead>
                  <TableHead className="text-right">עמלת סוכן</TableHead>
                  <TableHead className="text-right">שולם</TableHead>
                  <TableHead className="text-right">יתרה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentSummary.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.agent_name}</TableCell>
                    <TableCell>{row.deals}</TableCell>
                    <TableCell>{formatCurrency(row.commission)}</TableCell>
                    <TableCell>{formatCurrency(row.agent_commission)}</TableCell>
                    <TableCell>{formatCurrency(row.paid)}</TableCell>
                    <TableCell className="text-amber-700 font-semibold">{formatCurrency(row.agent_commission - row.paid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Deals list */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader><CardTitle className="text-base">עסקאות מפורטות</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right">חודש</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                {isAdmin(user) && <TableHead className="text-right">סוכן</TableHead>}
                <TableHead className="text-right">עמלה</TableHead>
                <TableHead className="text-right">נגבה</TableHead>
                <TableHead className="text-right">עמלת סוכן</TableHead>
                {isAdmin(user) && <TableHead className="text-right">עמלת משרד</TableHead>}
                <TableHead className="text-right">סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">אין נתונים</TableCell></TableRow>
              ) : deals.map(d => {
                const st = DEAL_STATUS_MAP[d.status] || DEAL_STATUS_MAP['פתוחה'];
                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.month}</TableCell>
                    <TableCell className="font-medium text-sm">{d.client_name}</TableCell>
                    {isAdmin(user) && <TableCell className="text-sm">{d.agent_name}</TableCell>}
                    <TableCell className="text-sm">{formatCurrency(d.commission_amount)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(d.collected_actual)}</TableCell>
                    <TableCell className="text-sm text-emerald-700">{formatCurrency(d.agent_commission)}</TableCell>
                    {isAdmin(user) && <TableCell className="text-sm text-primary">{formatCurrency(d.office_commission)}</TableCell>}
                    <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      </div>
    </div>
  );
}