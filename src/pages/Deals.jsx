import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Pencil, Trash2, FileSpreadsheet, Download, Loader2, Plus, FileText, TrendingUp, Wallet, CheckCircle } from 'lucide-react';
import { formatCurrency, DEAL_STATUS_MAP, computeDealStatus } from '@/lib/constants';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import DealFormDialog from '@/components/deals/DealFormDialog';
import DealDetailDialog from '@/components/deals/DealDetailDialog';
import ExcelImportDialog from '@/components/ExcelImportDialog';

const THIS_YEAR = String(new Date().getFullYear());
const THIS_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

// Derive status from data instead of stored field
function dealStatus(deal) {
  const status = computeDealStatus(deal);
  return DEAL_STATUS_MAP[status] || DEAL_STATUS_MAP['פתוחה'];
}

export default function Deals() {
  const { user } = useCurrentUser();
  const isAdminView = useIsAdminView();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [cooperationFilter, setCooperationFilter] = useState('all');
  const [filterMode, setFilterMode] = useState('month');
  const [filterMonth, setFilterMonth] = useState(THIS_MONTH);
  const [filterFromMonth, setFilterFromMonth] = useState(THIS_MONTH);
  const [filterToMonth, setFilterToMonth] = useState(THIS_MONTH);
  const [filterYear, setFilterYear] = useState(THIS_YEAR);
  const [editDeal, setEditDeal] = useState(null);
  const [viewDeal, setViewDeal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef(null);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditDeal({});
      setSearchParams({}, { replace: true });
    }
  }, []);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const { data: allDeals = [], isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => base44.entities.Deal.list('-created_date', 500),
  });

  const myAgent = agents.find(a => a.user_id === user?.id);
  const deals = useMemo(() => {
    if (isAdminView) return allDeals;
    return allDeals.filter(d => d.agent_id === myAgent?.id);
  }, [allDeals, user, myAgent]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Deal.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); toast.success('העסקה נמחקה'); },
    onError: () => toast.error('שגיאה במחיקת העסקה'),
  });

  const lawyers = useMemo(() => [...new Set(deals.map(d => d.lawyer_name).filter(Boolean))], [deals]);
  const cooperations = useMemo(() => [...new Set(deals.map(d => d.cooperation_agent).filter(Boolean))], [deals]);

  const matchesDate = (month) => {
    if (!month) return false;
    const y = month.slice(0, 4);
    if (filterMode === 'month') return month === filterMonth;
    if (filterMode === 'range') return month >= filterFromMonth && month <= filterToMonth;
    if (filterMode === 'year') return y === filterYear;
    return true;
  };

  const hasActiveFilter = true;

  const filtered = useMemo(() => {
    return deals.filter(d => {
      const computedStatus = computeDealStatus(d);
      const matchSearch = !search || d.client_name?.includes(search) || d.address?.includes(search) || d.agent_name?.includes(search);
      const matchStatus = statusFilter === 'all' || computedStatus === statusFilter;
      const matchAgent = agentFilter === 'all' || agentFilter === '__all__' || d.agent_id === agentFilter;
      const matchLawyer = lawyerFilter === 'all' || d.lawyer_name === lawyerFilter;
      const matchCooperation = cooperationFilter === 'all' || d.cooperation_agent === cooperationFilter;
      return matchSearch && matchStatus && matchAgent && matchLawyer && matchCooperation && matchesDate(d.month);
    });
  }, [deals, search, statusFilter, agentFilter, lawyerFilter, cooperationFilter, filterMode, filterMonth, filterFromMonth, filterToMonth, filterYear]);

  const availableYears = useMemo(() => {
    const years = [...new Set(deals.map(d => d.month?.slice(0, 4)).filter(Boolean))].sort().reverse();
    if (!years.includes(THIS_YEAR)) years.unshift(THIS_YEAR);
    return years;
  }, [deals]);

  // Summary stats (all deals for admin overview tiles)
  const allStats = useMemo(() => ({
    totalDeals: deals.length,
    totalCommission: deals.reduce((s, d) => s + (d.commission_amount || 0), 0),
    totalCollected: deals.reduce((s, d) => s + (d.collected_actual || 0), 0),
    closedDeals: deals.filter(d => computeDealStatus(d) === 'סגורה').length,
  }), [deals]);

  const VAT_RATE = 0.18;

  const filteredStats = useMemo(() => {
    const totalCommission = filtered.reduce((s, d) => s + (d.commission_amount || 0), 0);
    return {
      totalDeals: filtered.length,
      closedDeals: filtered.filter(d => computeDealStatus(d) === 'סגורה').length,
      totalCommission,
      totalVat: totalCommission * VAT_RATE,
      totalWithVat: totalCommission * (1 + VAT_RATE),
      totalCollected: filtered.reduce((s, d) => s + (d.collected_actual || 0), 0),
    };
  }, [filtered]);

  const displayStats = hasActiveFilter ? filteredStats : {
    ...allStats,
    totalVat: allStats.totalCommission * VAT_RATE,
    totalWithVat: allStats.totalCommission * (1 + VAT_RATE),
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = filtered.map(d => {
      const comm = d.commission_amount || 0;
      return {
        תאריך: d.month || '',
        לקוח: d.client_name || '',
        סוכן: d.agent_name || '',
        'סכום עסקה': d.deal_amount || 0,
        'עמלה לפני מע"מ': comm,
        'מע"מ': +(comm * VAT_RATE).toFixed(2),
        'סה"כ כולל מע"מ': +(comm * (1 + VAT_RATE)).toFixed(2),
        נגבה: d.collected_actual || 0,
        'עמלת סוכן': d.agent_commission || 0,
        'עמלת משרד': d.office_commission || 0,
        סטטוס: computeDealStatus(d),
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'עסקאות');
    XLSX.writeFile(wb, `עסקאות_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      pdf.save(`עסקאות_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('הדוח יוצא בהצלחה');
    } catch { toast.error('שגיאה בייצוא PDF'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="me-auto">
          <h1 className="text-2xl font-bold">עסקאות</h1>
          <p className="text-muted-foreground text-sm mt-1">{deals.length} עסקאות במערכת</p>
        </div>
        {isAdminView && (
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="w-4 h-4" /> ייבוא מאקסל
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportExcel} disabled={!hasActiveFilter}>
          <Download className="w-4 h-4" /> Excel
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportPDF} disabled={exporting || !hasActiveFilter}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
        </Button>

      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600"><FileText className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ עסקאות</p><p className="text-xl font-bold">{displayStats.totalDeals}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">עסקאות סגורות</p><p className="text-xl font-bold">{displayStats.closedDeals}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary"><TrendingUp className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ עמלות</p><p className="text-xl font-bold">{formatCurrency(displayStats.totalCommission)}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600"><Wallet className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">סה״כ נגבה</p><p className="text-xl font-bold">{formatCurrency(displayStats.totalCollected)}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="חיפוש לקוח, כתובת, סוכן..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.keys(DEAL_STATUS_MAP).map(k => (
                  <SelectItem key={k} value={k}>{DEAL_STATUS_MAP[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdminView && (
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="סוכן" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוכנים</SelectItem>
                  <SelectItem value="__all__">הצג את כולם</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isAdminView && (
              <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
                <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder='עו"ד' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל עוה"ד</SelectItem>
                  {lawyers.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {isAdminView && (
              <Select value={cooperationFilter} onValueChange={setCooperationFilter}>
                <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder='שת"פ' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השת"פים</SelectItem>
                  {cooperations.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border overflow-hidden">
              {[['month', 'חודש'], ['range', 'טווח'], ['year', 'שנה']].map(([mode, label]) => (
                <button key={mode} onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${filterMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                  {label}
                </button>
              ))}
            </div>
            {filterMode === 'month' && (
              <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-36 rounded-xl" />
            )}
            {filterMode === 'range' && (
              <>
                <Input type="month" value={filterFromMonth} onChange={e => setFilterFromMonth(e.target.value)} className="w-36 rounded-xl" />
                <span className="text-muted-foreground text-sm">—</span>
                <Input type="month" value={filterToMonth} onChange={e => setFilterToMonth(e.target.value)} className="w-36 rounded-xl" />
              </>
            )}
            {filterMode === 'year' && (
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <>
          {filtered.length > 0 && (
            <div className="text-sm text-muted-foreground flex gap-4 flex-wrap px-1">
              <span>{filtered.length} עסקאות</span>
              <span>עמלות: <strong className="text-foreground">{formatCurrency(filteredStats.totalCommission)}</strong></span>
              <span>מע"מ: <strong className="text-foreground">{formatCurrency(filteredStats.totalVat)}</strong></span>
              <span>סה"כ כולל מע"מ: <strong className="text-foreground">{formatCurrency(filteredStats.totalWithVat)}</strong></span>
              <span>נגבה: <strong className="text-emerald-700">{formatCurrency(filteredStats.totalCollected)}</strong></span>
            </div>
          )}
          <Card className="rounded-2xl overflow-hidden" ref={tableRef}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">לקוח</TableHead>
                    {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                    <TableHead className="text-right">סכום עסקה</TableHead>
                    <TableHead className="text-right">עמלה</TableHead>
                    <TableHead className="text-right">מע"מ</TableHead>
                    <TableHead className="text-right">סה"כ כולל מע"מ</TableHead>
                    <TableHead className="text-right">נגבה</TableHead>
                    <TableHead className="text-right">% גבייה</TableHead>
                    <TableHead className="text-right">עמלת סוכן</TableHead>
                    {isAdminView && <TableHead className="text-right">עמלת משרד</TableHead>}
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={isAdminView ? 13 : 11} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={isAdminView ? 13 : 11} className="text-center py-12 text-muted-foreground">לא נמצאו עסקאות התואמות את הסינון</TableCell></TableRow>
                  ) : filtered.map(deal => {
                    const st = dealStatus(deal);
                    const commPct = deal.commission_amount > 0
                      ? Math.round((deal.collected_actual || 0) / deal.commission_amount * 100)
                      : 0;
                    return (
                      <TableRow key={deal.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setViewDeal(deal)}>
                        <TableCell className="text-sm">{deal.month || '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{deal.client_name}</TableCell>
                        {isAdminView && <TableCell className="text-sm">{deal.agent_name || '-'}</TableCell>}
                        <TableCell className="font-semibold text-sm">{formatCurrency(deal.deal_amount)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(deal.commission_amount)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency((deal.commission_amount || 0) * VAT_RATE)}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency((deal.commission_amount || 0) * (1 + VAT_RATE))}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(deal.collected_actual)}</TableCell>
                        <TableCell className="text-sm">
                          <span className={commPct >= 100 ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                            {commPct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(deal.agent_commission)}</TableCell>
                        {isAdminView && <TableCell className="text-sm font-medium text-primary">{formatCurrency(deal.office_commission)}</TableCell>}
                        <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => setEditDeal(deal)}><Pencil className="w-4 h-4 ml-2" /> עריכה</DropdownMenuItem>
                              {isAdminView && (
                                <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`למחוק את העסקה "${deal.client_name}"?`)) deleteMutation.mutate(deal.id); }}>
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
        </>

      {viewDeal && !editDeal && (
        <DealDetailDialog
          deal={viewDeal}
          agents={agents}
          currentUser={user}
          onEdit={() => { setEditDeal(viewDeal); setViewDeal(null); }}
          onClose={() => setViewDeal(null)}
        />
      )}

      {editDeal !== null && (
        <DealFormDialog
          deal={editDeal}
          agents={agents}
          currentUser={user}
          myAgent={myAgent}
          onClose={() => setEditDeal(null)}
        />
      )}

      {showImport && (
        <ExcelImportDialog
          type="deals"
          agents={agents}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
