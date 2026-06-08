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
import { Plus, Search, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, DEAL_STATUS_MAP } from '@/lib/constants';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import DealFormDialog from '@/components/deals/DealFormDialog';
import DealDetailDialog from '@/components/deals/DealDetailDialog';

export default function Deals() {
  const { user } = useCurrentUser();
  const isAdminView = useIsAdminView();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [cooperationFilter, setCooperationFilter] = useState('all');
  const [editDeal, setEditDeal] = useState(null);
  const [viewDeal, setViewDeal] = useState(null);
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

  // filter by agent if not admin
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

  const filtered = useMemo(() => deals.filter(d => {
    const matchSearch = !search || d.client_name?.includes(search) || d.address?.includes(search) || d.agent_name?.includes(search);
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchAgent = agentFilter === 'all' || d.agent_id === agentFilter;
    const matchLawyer = lawyerFilter === 'all' || d.lawyer_name === lawyerFilter;
    const matchCooperation = cooperationFilter === 'all' || d.cooperation_agent === cooperationFilter;
    return matchSearch && matchStatus && matchAgent && matchLawyer && matchCooperation;
  }), [deals, search, statusFilter, agentFilter, lawyerFilter, cooperationFilter]);

  const totalCommission = filtered.reduce((s, d) => s + (d.commission_amount || 0), 0);
  const totalCollected = filtered.reduce((s, d) => s + (d.collected_actual || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="me-auto">
          <h1 className="text-2xl font-bold">עסקאות</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} עסקאות • עמלות: {formatCurrency(totalCommission)} • נגבה: {formatCurrency(totalCollected)}
          </p>
        </div>
        {isAdminView && (
          <Button className="gap-2 rounded-xl" onClick={() => setEditDeal({})}>
            עסקה חדשה <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="חיפוש לקוח, כתובת, סוכן..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="סטטוס" /></SelectTrigger>
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
                  {agents.filter(a => a.is_active).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isAdminView && lawyers.length > 0 && (
              <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
                <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder='עו"ד' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל עוה"ד</SelectItem>
                  {lawyers.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {isAdminView && cooperations.length > 0 && (
              <Select value={cooperationFilter} onValueChange={setCooperationFilter}>
                <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder='שת"פ' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השת"פים</SelectItem>
                  {cooperations.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">כתובת</TableHead>
                {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                <TableHead className="text-right">סכום עסקה</TableHead>
                <TableHead className="text-right">עמלה</TableHead>
                <TableHead className="text-right">נגבה</TableHead>
                <TableHead className="text-right">עמלת סוכן</TableHead>
                {isAdminView && <TableHead className="text-right">עמלת משרד</TableHead>}
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={isAdminView ? 11 : 9} className="text-center py-12 text-muted-foreground">לא נמצאו עסקאות</TableCell></TableRow>
              ) : filtered.map(deal => {
                const st = DEAL_STATUS_MAP[deal.status] || DEAL_STATUS_MAP['פתוחה'];
                return (
                  <TableRow key={deal.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setViewDeal(deal)}>
                   <TableCell className="text-sm">{deal.month || '-'}</TableCell>
                   <TableCell className="font-medium text-sm">{deal.client_name}</TableCell>
                   <TableCell className="text-sm text-muted-foreground">{deal.address || '-'}</TableCell>
                   {isAdminView && <TableCell className="text-sm">{deal.agent_name || '-'}</TableCell>}
                   <TableCell className="font-semibold text-sm">{formatCurrency(deal.deal_amount)}</TableCell>
                   <TableCell className="text-sm">{formatCurrency(deal.commission_amount)}</TableCell>
                   <TableCell className="text-sm">{formatCurrency(deal.collected_actual)}</TableCell>
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
                           <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`למחוק את העסקה "${deal.client_name}"? פעולה זו אינה ניתנת לביטול.`)) deleteMutation.mutate(deal.id); }}>
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
    </div>
  );
}