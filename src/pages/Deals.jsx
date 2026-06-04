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
import { isAdmin } from '@/lib/roles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import DealFormDialog from '@/components/deals/DealFormDialog';
import DealDetailDialog from '@/components/deals/DealDetailDialog';

export default function Deals() {
  const { user } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
    if (isAdmin(user)) return allDeals;
    return allDeals.filter(d => d.agent_id === myAgent?.id);
  }, [allDeals, user, myAgent]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Deal.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); toast.success('העסקה נמחקה'); },
    onError: () => toast.error('שגיאה במחיקת העסקה'),
  });

  const filtered = useMemo(() => deals.filter(d => {
    const matchSearch = !search || d.client_name?.includes(search) || d.address?.includes(search) || d.agent_name?.includes(search);
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  }), [deals, search, statusFilter]);

  const totalCommission = filtered.reduce((s, d) => s + (d.commission_amount || 0), 0);
  const totalCollected = filtered.reduce((s, d) => s + (d.collected_actual || 0), 0);

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">עסקאות</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} עסקאות • עמלות: {formatCurrency(totalCommission)} • נגבה: {formatCurrency(totalCollected)}
          </p>
        </div>
        <Button className="gap-2 rounded-xl" onClick={() => setEditDeal({})}>
          <Plus className="w-4 h-4" /> עסקה חדשה
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="חיפוש לקוח, כתובת, סוכן..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.keys(DEAL_STATUS_MAP).map(k => (
                  <SelectItem key={k} value={k}>{DEAL_STATUS_MAP[k].label}</SelectItem>
                ))}
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
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">כתובת</TableHead>
                {isAdmin(user) && <TableHead className="text-right">סוכן</TableHead>}
                <TableHead className="text-right">סכום עסקה</TableHead>
                <TableHead className="text-right">עמלה</TableHead>
                <TableHead className="text-right">נגבה</TableHead>
                <TableHead className="text-right">עמלת סוכן</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">לא נמצאו עסקאות</TableCell></TableRow>
              ) : filtered.map(deal => {
                const st = DEAL_STATUS_MAP[deal.status] || DEAL_STATUS_MAP['פתוחה'];
                return (
                  <TableRow key={deal.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setViewDeal(deal)}>
                   <TableCell className="text-sm">{deal.month || '-'}</TableCell>
                   <TableCell className="font-medium text-sm">{deal.client_name}</TableCell>
                   <TableCell className="text-sm text-muted-foreground">{deal.address || '-'}</TableCell>
                   {isAdmin(user) && <TableCell className="text-sm">{deal.agent_name || '-'}</TableCell>}
                   <TableCell className="font-semibold text-sm">{formatCurrency(deal.deal_amount)}</TableCell>
                   <TableCell className="text-sm">{formatCurrency(deal.commission_amount)}</TableCell>
                   <TableCell className="text-sm">{formatCurrency(deal.collected_actual)}</TableCell>
                   <TableCell className="text-sm">{formatCurrency(deal.agent_commission)}</TableCell>
                   <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                   <TableCell onClick={e => e.stopPropagation()}>
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="start">
                         <DropdownMenuItem onClick={() => setEditDeal(deal)}><Pencil className="w-4 h-4 ml-2" /> עריכה</DropdownMenuItem>
                         {isAdmin(user) && (
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