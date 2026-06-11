import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  BarChart3, Users, MapPin, TrendingUp, DollarSign,
  Plus, Pencil, Trash2, Phone, Mail, Percent, ArrowRight,
  FileText, Building2, CheckCircle2, Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/constants';
import { downloadCSV } from '@/lib/csv';

// ---- Agents Tab ----
function AgentsTab() {
  const EMPTY = { name: '', email: '', phone: '', commission_percent: 50, is_active: true, notes: '' };
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 200) });
  const { data: allExpenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 200) });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.id) return base44.entities.Agent.update(dialog.id, form);
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, role: 'agent' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'שגיאה בשליחת הזמנה');
      return base44.entities.Agent.create({ ...form, user_id: result.userId });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agents'] }); toast.success(dialog.id ? 'הסוכן עודכן' : 'הסוכן נוסף — הזמנה נשלחה למייל'); setDialog(null); },
    onError: (err) => toast.error(err.message || 'שגיאה בשמירת הסוכן'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agents'] }); toast.success('הסוכן נמחק'); },
    onError: () => toast.error('שגיאה במחיקת הסוכן'),
  });

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const openNew = () => { setForm(EMPTY); setDialog({}); };
  const openEdit = (a) => { setForm({ ...a }); setDialog(a); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{agents.length} סוכנים</p>
        <Button className="gap-2 rounded-xl" onClick={openNew}><Plus className="w-4 h-4" /> סוכן חדש</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {agents.map(agent => {
          const agentDeals = allDeals.filter(d => d.agent_id === agent.id);
          const agentExpenses = allExpenses.filter(e => e.agent_id === agent.id);
          const totalCommission = agentDeals.reduce((s, d) => s + (d.agent_commission || 0), 0);
          return (
            <Card key={agent.id} className="rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <Badge variant="secondary" className={agent.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                      {agent.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(agent)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(`למחוק את הסוכן "${agent.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteMutation.mutate(agent.id); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {agent.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{agent.phone}</div>}
                  {agent.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{agent.email}</div>}
                  <div className="flex items-center gap-2"><Percent className="w-3.5 h-3.5" />עמלה: {agent.commission_percent || 0}%</div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-muted-foreground">עסקאות</p>
                    <p className="font-semibold">{agentDeals.length}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-muted-foreground">עמלות</p>
                    <p className="font-semibold">{formatCurrency(totalCommission)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-muted-foreground">הוצאות</p>
                    <p className="font-semibold">{agentExpenses.length}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-muted-foreground">ממתין אישור</p>
                    <p className="font-semibold text-amber-600">{agentExpenses.filter(e => e.status === 'pending_approval').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {agents.length === 0 && <div className="col-span-2 text-center py-12 text-muted-foreground">אין סוכנים עדיין</div>}
      </div>

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dialog?.id ? 'עריכת סוכן' : 'סוכן חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">שם סוכן *</Label><Input value={form.name} onChange={e => upd('name', e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">מייל {!dialog?.id && <span className="text-destructive">*</span>}</Label>
              <Input type="email" value={form.email} onChange={e => upd('email', e.target.value)} disabled={!!dialog?.id} />
              {!dialog?.id && <p className="text-xs text-muted-foreground">הזמנה תישלח אוטומטית לכתובת זו</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">טלפון</Label><Input value={form.phone} onChange={e => upd('phone', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">אחוז עמלה (%)</Label><Input type="number" value={form.commission_percent} onChange={e => upd('commission_percent', parseFloat(e.target.value))} /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => upd('is_active', v)} /><Label>סוכן פעיל</Label></div>
            <div className="space-y-1"><Label className="text-xs">הערות</Label><Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} /></div>
            <Button className="w-full rounded-xl" onClick={() => saveMutation.mutate()} disabled={!form.name || (!dialog?.id && !form.email) || saveMutation.isPending}>
              {dialog?.id ? 'שמור שינויים' : 'הוסף סוכן'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Areas Tab ----
function AreasTab() {
  const [areas, setAreas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('app_areas') || '["תל אביב","ירושלים","חיפה","הרצליה","רמת גן","פתח תקווה","ראשון לציון","נתניה"]'); } catch { return []; }
  });
  const [newArea, setNewArea] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState('');

  const save = (list) => { setAreas(list); localStorage.setItem('app_areas', JSON.stringify(list)); };
  const add = () => { if (!newArea.trim()) return; save([...areas, newArea.trim()]); setNewArea(''); toast.success('האזור נוסף'); };
  const remove = (i) => { if (window.confirm(`למחוק את האזור "${areas[i]}"?`)) save(areas.filter((_, idx) => idx !== i)); };
  const saveEdit = () => { const a = [...areas]; a[editIdx] = editVal.trim(); save(a); setEditIdx(null); toast.success('האזור עודכן'); };

  return (
    <div className="space-y-4 max-w-md">
      <div className="flex gap-2">
        <Input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="שם אזור חדש" onKeyDown={e => e.key === 'Enter' && add()} />
        <Button onClick={add} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> הוסף</Button>
      </div>
      <div className="space-y-2">
        {areas.map((area, i) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
            {editIdx === i ? (
              <>
                <Input value={editVal} onChange={e => setEditVal(e.target.value)} className="flex-1 h-8" autoFocus />
                <Button size="sm" onClick={saveEdit}>שמור</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)}>ביטול</Button>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm">{area}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditIdx(i); setEditVal(area); }}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </>
            )}
          </div>
        ))}
        {areas.length === 0 && <p className="text-center py-6 text-muted-foreground text-sm">אין אזורים עדיין</p>}
      </div>
    </div>
  );
}

// ---- Reports Tab ----
function ReportsTab() {
  const [agentFilter, setAgentFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: deals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 500) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 500) });

  const filtered = useMemo(() => {
    let d = deals;
    if (agentFilter !== 'all') d = d.filter(x => x.agent_id === agentFilter);
    if (monthFilter) d = d.filter(x => x.month === monthFilter);
    return d;
  }, [deals, agentFilter, monthFilter]);

  const filteredExpenses = useMemo(() => {
    let e = expenses.filter(x => x.scope === 'office' || x.scope === 'agent');
    if (agentFilter !== 'all') e = e.filter(x => x.agent_id === agentFilter);
    return e;
  }, [expenses, agentFilter]);

  const summaryStats = useMemo(() => {
    const totalCommission = filtered.reduce((s, d) => s + (d.commission_amount || 0), 0);
    const totalCollected = filtered.reduce((s, d) => s + (d.collected_actual || 0), 0);
    const totalAgentComm = filtered.reduce((s, d) => s + (d.agent_commission || 0), 0);
    const totalOfficeComm = filtered.reduce((s, d) => s + (d.office_commission || 0), 0);
    const officeExpenses = filteredExpenses.filter(e => e.scope === 'office').reduce((s, e) => s + (e.total_amount || 0), 0);
    return { totalCommission, totalCollected, totalAgentComm, totalOfficeComm, netProfit: totalOfficeComm - officeExpenses };
  }, [filtered, filteredExpenses]);
  const { totalCommission, totalCollected, totalAgentComm, totalOfficeComm, netProfit } = summaryStats;

  const agentSummary = useMemo(() => agents.map(a => {
    const aDeals = filtered.filter(d => d.agent_id === a.id);
    const aExpenses = filteredExpenses.filter(e => e.agent_id === a.id);
    return {
      ...a,
      deals: aDeals.length,
      commission: aDeals.reduce((s, d) => s + (d.commission_amount || 0), 0),
      agentComm: aDeals.reduce((s, d) => s + (d.agent_commission || 0), 0),
      officeComm: aDeals.reduce((s, d) => s + (d.office_commission || 0), 0),
      expenses: aExpenses.reduce((s, e) => s + (e.total_amount || 0), 0),
    };
  }).filter(a => a.deals > 0 || a.expenses > 0), [agents, filtered, filteredExpenses]);

  const areaBreakdown = useMemo(() => Object.entries(
    filtered.reduce((acc, d) => {
      const k = d.area || 'לא מוגדר';
      if (!acc[k]) acc[k] = { count: 0, commission: 0 };
      acc[k].count++; acc[k].commission += d.commission_amount || 0;
      return acc;
    }, {})
  ), [filtered]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-32">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="כל הסוכנים" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסוכנים</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="rounded-xl w-40" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'סה"כ עסקאות', value: filtered.length, Icon: FileText, color: 'bg-blue-100 text-blue-600' },
          { label: 'סה"כ עמלות', value: formatCurrency(totalCommission), Icon: DollarSign, color: 'bg-purple-100 text-purple-600' },
          { label: 'נגבה בפועל', value: formatCurrency(totalCollected), Icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'עמלות סוכנים', value: formatCurrency(totalAgentComm), Icon: Users, color: 'bg-amber-100 text-amber-600' },
          { label: 'עמלות משרד', value: formatCurrency(totalOfficeComm), Icon: Building2, color: 'bg-indigo-100 text-indigo-600' },
          { label: 'רווח נקי', value: formatCurrency(netProfit), Icon: TrendingUp, color: 'bg-rose-100 text-rose-600' },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label} className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${color}`}><Icon className="w-4 h-4" /></div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent summary */}
      {agentSummary.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">סיכום לפי סוכן</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {agentSummary.map(a => (
                <div key={a.id} className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div><p className="font-semibold">{a.name}</p><p className="text-xs text-muted-foreground">{a.deals} עסקאות</p></div>
                  <div><p className="text-xs text-muted-foreground">עמלת סוכן</p><p className="font-medium text-emerald-700">{formatCurrency(a.agentComm)}</p></div>
                  <div><p className="text-xs text-muted-foreground">עמלת משרד</p><p className="font-medium text-primary">{formatCurrency(a.officeComm)}</p></div>
                  <div><p className="text-xs text-muted-foreground">הוצאות</p><p className="font-medium text-red-600">{formatCurrency(a.expenses)}</p></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Area breakdown */}
      {filtered.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">לפי אזור</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {areaBreakdown.map(([area, data]) => (
                <div key={area} className="p-3 flex justify-between text-sm">
                  <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{area}</span>
                  <span className="text-muted-foreground">{data.count} עסקאות • {formatCurrency(data.commission)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Pending Agents Tab ----
function PendingAgentsTab() {
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['pending-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .eq('is_approved', false)
        .eq('role', 'agent');
      if (error) throw error;
      // get emails from auth.users via service-role — we'll show what we have
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (agent) => {
      const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', agent.id);
      if (error) throw error;
      // שלח מייל אישור — best effort, לא חוסם
      try {
        const { data: authUser } = await supabase.auth.admin?.getUserById?.(agent.id) || {};
        const email = authUser?.user?.email;
        if (email) {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: email, type: 'agent_approved', data: { name: agent.full_name } }),
          });
        }
      } catch { /* non-fatal */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-profiles'] });
      toast.success('הסוכן אושר בהצלחה');
    },
    onError: () => toast.error('שגיאה באישור הסוכן'),
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">טוען...</div>;

  if (pending.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
        <p className="font-medium">אין סוכנים ממתינים לאישור</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-xl">
      {pending.map(p => (
        <Card key={p.id} className="rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{p.full_name || 'ללא שם'}</p>
              <p className="text-sm text-muted-foreground">{p.phone || ''}</p>
              <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => approveMutation.mutate(p)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4" /> אשר גישה
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Export Tab ----
function ExportTab() {
  const { data: deals = [], isLoading: loadingDeals } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 1000) });
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 1000) });
  const { data: agents = [], isLoading: loadingAgents } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });

  const exports = [
    {
      label: 'עסקאות', icon: FileText, color: 'bg-blue-100 text-blue-600',
      loading: loadingDeals,
      onExport: () => downloadCSV('עסקאות.csv', deals, {
        month: 'חודש', client_name: 'לקוח', address: 'כתובת', area: 'אזור',
        agent_name: 'סוכן', side: 'צד', deal_amount: 'סכום עסקה',
        commission_amount: 'עמלה', collected_actual: 'נגבה',
        agent_commission: 'עמלת סוכן', office_commission: 'עמלת משרד',
        paid_to_agent: 'שולם לסוכן', status: 'סטטוס',
        payment_method: 'אמצעי תשלום', lead_source: 'מקור ליד',
      }),
    },
    {
      label: 'הוצאות', icon: Receipt, color: 'bg-purple-100 text-purple-600',
      loading: loadingExpenses,
      onExport: () => downloadCSV('הוצאות.csv', expenses, {
        date: 'תאריך', vendor_name: 'ספק', category: 'קטגוריה',
        total_amount: 'סכום', currency: 'מטבע', payment_method: 'אמצעי תשלום',
        agent_name: 'סוכן', scope: 'שיוך', status: 'סטטוס',
        has_receipt: 'יש קבלה', notes: 'הערות',
      }),
    },
    {
      label: 'סוכנים', icon: Users, color: 'bg-emerald-100 text-emerald-600',
      loading: loadingAgents,
      onExport: () => downloadCSV('סוכנים.csv', agents, {
        name: 'שם', email: 'מייל', phone: 'טלפון',
        commission_percent: 'אחוז עמלה', is_active: 'פעיל',
      }),
    },
  ];

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-muted-foreground">ייצוא כל הנתונים לקובץ CSV שאפשר לפתוח ב-Excel.</p>
      <div className="space-y-3">
        {exports.map(({ label, icon: Icon, color, loading, onExport }) => (
          <Card key={label} className="rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
                <p className="font-medium">{label}</p>
              </div>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={onExport} disabled={loading}>
                <Download className="w-4 h-4" /> ייצוא CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- Main Admin Panel ----
export default function AdminPanel() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">הגדרות ניהול</h1>
          <p className="text-sm text-muted-foreground">דוחות, סוכנים ואזורים</p>
        </div>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="reports" className="gap-2 rounded-lg"><BarChart3 className="w-4 h-4" /> דוחות</TabsTrigger>
          <TabsTrigger value="agents" className="gap-2 rounded-lg"><Users className="w-4 h-4" /> סוכנים</TabsTrigger>
          <TabsTrigger value="areas" className="gap-2 rounded-lg"><MapPin className="w-4 h-4" /> אזורים</TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
        <TabsContent value="agents" className="mt-4"><AgentsTab /></TabsContent>
        <TabsContent value="areas" className="mt-4"><AreasTab /></TabsContent>
      </Tabs>
    </div>
  );
}