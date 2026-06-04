import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { TrendingUp, DollarSign, FileText, AlertCircle, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, DEAL_STATUS_MAP } from '@/lib/constants';
import { isAdmin } from '@/lib/roles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const formatShortCurrency = (v) => `₪${(v / 1000).toFixed(0)}k`;

export default function Dashboard() {
  const { user, loading } = useCurrentUser();

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 200) });
  const { data: allExpenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 100) });

  const myAgent = agents.find(a => a.user_id === user?.id);

  const deals = useMemo(() => {
    if (isAdmin(user)) return allDeals;
    return allDeals.filter(d => d.agent_id === myAgent?.id);
  }, [allDeals, user, myAgent]);

  const expenses = useMemo(() => {
    if (isAdmin(user)) return allExpenses;
    return allExpenses.filter(e => e.agent_id === myAgent?.id || e.created_by_id === user?.id);
  }, [allExpenses, user, myAgent]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const stats = useMemo(() => {
    const monthDeals = deals.filter(d => d.month === thisMonth);
    return {
      monthDeals,
      totalCommission: monthDeals.reduce((s, d) => s + (d.commission_amount || 0), 0),
      totalCollected: monthDeals.reduce((s, d) => s + (d.collected_actual || 0), 0),
      totalAgentCommission: monthDeals.reduce((s, d) => s + (d.agent_commission || 0), 0),
      totalPaidToAgent: monthDeals.reduce((s, d) => s + (d.paid_to_agent || 0), 0),
      pendingExpenses: expenses.filter(e => e.status === 'pending_approval').length,
    };
  }, [deals, expenses, thisMonth]);

  const { monthDeals, totalCommission, totalCollected, totalAgentCommission, totalPaidToAgent, pendingExpenses } = stats;

  // גרף עמלות 6 חודשים אחרונים
  const monthlyChart = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('he-IL', { month: 'short' });
      const mDeals = deals.filter(x => x.month === key);
      return {
        month: label,
        עמלות: Math.round(mDeals.reduce((s, x) => s + (x.commission_amount || 0), 0)),
        נגבה: Math.round(mDeals.reduce((s, x) => s + (x.collected_actual || 0), 0)),
      };
    });
  }, [deals, now]);

  // גרף לפי סוכן — אדמין בלבד
  const agentChart = useMemo(() => {
    if (!isAdmin(user)) return [];
    return agents.filter(a => a.is_active).map(a => {
      const aDeals = allDeals.filter(d => d.agent_id === a.id);
      return {
        name: a.name.split(' ')[0],
        עמלה: Math.round(aDeals.reduce((s, d) => s + (d.agent_commission || 0), 0)),
        עסקאות: aDeals.length,
      };
    }).filter(a => a.עסקאות > 0);
  }, [agents, allDeals, user]);

  const hasChartData = monthlyChart.some(m => m.עמלות > 0);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <img src="/logo.webp" alt="אליעזר נכסים" className="h-8 object-contain" />
          </div>
          <h1 className="text-2xl font-bold">שלום, {user?.full_name?.split(' ')[0] || 'משתמש'} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">{format(now, 'MMMM yyyy')} • {isAdmin(user) ? 'ניהול משרד' : 'פורטל סוכנים'}</p>
        </div>
        {isAdmin(user) && (
          <Link to="/admin">
            <Button variant="outline" className="gap-2 rounded-xl text-sm">
              <Settings2 className="w-4 h-4" /> הגדרות ניהול
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl"><FileText className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">עסקאות החודש</p>
                <p className="text-2xl font-bold">{monthDeals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl"><DollarSign className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">סה"כ עמלות</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{isAdmin(user) ? 'נגבה' : 'עמלה שלי'}</p>
                <p className="text-2xl font-bold">{formatCurrency(isAdmin(user) ? totalCollected : totalAgentCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${pendingExpenses > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                <AlertCircle className={`w-5 h-5 ${pendingExpenses > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isAdmin(user) ? 'ממתין לאישור' : 'יתרה לתשלום'}</p>
                <p className="text-2xl font-bold">
                  {isAdmin(user) ? pendingExpenses : formatCurrency(totalAgentCommission - totalPaidToAgent)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* גרף עמלות חודשי */}
      {hasChartData && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4">עמלות — 6 חודשים אחרונים</h2>
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyChart} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="עמלות" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="נגבה" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* גרף לפי סוכן — אדמין */}
      {isAdmin(user) && agentChart.length > 1 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4">עמלות לפי סוכן (כולל)</h2>
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agentChart} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v, name) => name === 'עמלה' ? formatCurrency(v) : v} />
                  <Legend />
                  <Bar dataKey="עמלה" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent deals */}
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">עסקאות אחרונות</h2>
            <Link to="/deals" className="text-sm text-primary hover:underline">כל העסקאות</Link>
          </div>
          {deals.slice(0, 5).length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">אין עסקאות עדיין</p>
          ) : (
            <div className="space-y-2">
              {deals.slice(0, 5).map(d => {
                const st = DEAL_STATUS_MAP[d.status] || DEAL_STATUS_MAP['פתוחה'];
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{d.client_name}</p>
                      <p className="text-xs text-muted-foreground">{d.address || ''} {isAdmin(user) ? `• ${d.agent_name || ''}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(d.commission_amount)}</p>
                      <Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent: recent expenses */}
      {!isAdmin(user) && (
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">הוצאות אחרונות</h2>
              <Link to="/expenses" className="text-sm text-primary hover:underline">כל ההוצאות</Link>
            </div>
            {expenses.slice(0, 5).length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">אין הוצאות עדיין</p>
            ) : (
              <div className="space-y-2">
                {expenses.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{e.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">{e.category || ''} • {e.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(e.total_amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        e.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                        e.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        e.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {e.status === 'pending_approval' ? 'ממתינה לאישור' :
                         e.status === 'approved' ? 'מאושרת' :
                         e.status === 'rejected' ? 'נדחתה' : e.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin: agent summary */}
      {isAdmin(user) && agents.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">סוכנים פעילים</h2>
              <Link to="/agents" className="text-sm text-primary hover:underline">ניהול סוכנים</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {agents.filter(a => a.is_active).map(a => {
                const agentDeals = allDeals.filter(d => d.agent_id === a.id && d.month === thisMonth);
                const agentTotal = agentDeals.reduce((s, d) => s + (d.agent_commission || 0), 0);
                return (
                  <div key={a.id} className="p-3 bg-muted/50 rounded-xl">
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{agentDeals.length} עסקאות • {formatCurrency(agentTotal)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin: quick links */}
      {isAdmin(user) && (
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">קישורים מהירים</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { to: '/pending', label: 'ממתין לאישור', count: pendingExpenses, countColor: 'text-amber-600' },
                { to: '/missing-receipts', label: 'חסרות קבלות', count: null, countColor: '' },
                { to: '/anomalies', label: 'הוצאות חריגות', count: null, countColor: '' },
                { to: '/activity', label: 'יומן פעילות', count: null, countColor: '' },
              ].map(({ to, label, count, countColor }) => (
                <Link key={to} to={to} className="p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors text-center">
                  <p className="text-sm font-medium">{label}</p>
                  {count !== null && count > 0 && <p className={`text-lg font-bold ${countColor}`}>{count}</p>}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
