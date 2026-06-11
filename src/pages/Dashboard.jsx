import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, FileText, Users, Building2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, DEAL_STATUS_MAP, STATUS_MAP } from '@/lib/constants';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const formatShortCurrency = (v) => `₪${(v / 1000).toFixed(0)}k`;

export default function Dashboard() {
  const { user } = useCurrentUser();
  const isAdminView = useIsAdminView();

  const dealsPath  = isAdminView ? '/admin/deals'    : '/deals';
  const agentsPath = isAdminView ? '/admin/agents'   : '/';
  const reportsPath = isAdminView ? '/admin/reports' : '/reports';
  const expensesPath = isAdminView ? '/admin/expenses' : '/expenses';

  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });
  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 200) });
  const { data: allExpenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 100) });

  const myAgent = agents.find(a => a.user_id === user?.id);

  const deals = useMemo(() => {
    if (isAdminView) return allDeals;
    return allDeals.filter(d => d.agent_id === myAgent?.id);
  }, [allDeals, isAdminView, myAgent]);

  const expenses = useMemo(() => {
    if (isAdminView) return allExpenses;
    return allExpenses.filter(e => e.agent_id === myAgent?.id || e.created_by_id === user?.id);
  }, [allExpenses, isAdminView, myAgent, user?.id]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const regularExpenses = useMemo(() => allExpenses.filter(e => e.status !== 'gmail_inbox'), [allExpenses]);

  const stats = useMemo(() => {
    const monthDeals = deals.filter(d => d.month === thisMonth);
    const monthExpenses = regularExpenses.filter(e => e.date?.startsWith(thisMonth));
    return {
      monthDeals,
      totalCommission: monthDeals.reduce((s, d) => s + (d.commission_amount || 0), 0),
      totalCollected: monthDeals.reduce((s, d) => s + (d.collected_actual || 0), 0),
      totalAgentCommission: monthDeals.reduce((s, d) => s + (d.agent_commission || 0), 0),
      totalOfficeCommission: monthDeals.reduce((s, d) => s + (d.office_commission || 0), 0),
      totalPaidToAgent: monthDeals.reduce((s, d) => s + (d.paid_to_agent || 0), 0),
      pendingExpenses: regularExpenses.filter(e => e.status === 'pending_approval').length,
      totalMonthExpenses: monthExpenses.reduce((s, e) => s + (e.total_amount || 0), 0),
    };
  }, [deals, regularExpenses, thisMonth]);

  const { monthDeals, totalCommission, totalCollected, totalAgentCommission, totalOfficeCommission, totalPaidToAgent, pendingExpenses, totalMonthExpenses } = stats;

  const monthlyChart = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('he-IL', { month: 'short' });
      const mDeals = deals.filter(x => x.month === key);
      return {
        month: label,
        עמלות: Math.round(mDeals.reduce((s, x) => s + (x.commission_amount || 0), 0)),
        עסקאות: mDeals.length,
      };
    });
  }, [deals]);

  const agentChart = useMemo(() => {
    if (!isAdminView) return [];
    return agents.filter(a => a.is_active).map(a => {
      const aDeals = allDeals.filter(d => d.agent_id === a.id);
      return {
        name: a.name.split(' ')[0],
        עמלה: Math.round(aDeals.reduce((s, d) => s + (d.agent_commission || 0), 0)),
        עסקאות: aDeals.length,
      };
    }).filter(a => a.עסקאות > 0);
  }, [agents, allDeals, isAdminView]);

  const hasChartData = monthlyChart.some(m => m.עמלות > 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <img src="/logo.webp" alt="אליעזר נכסים" className="h-8 object-contain" />
        </div>
        <h1 className="text-2xl font-bold">שלום, {user?.full_name || 'משתמש'} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(now, 'MM/yyyy')} • {isAdminView ? 'ניהול משרד' : 'פורטל סוכנים'}
        </p>
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

        {isAdminView ? (
          <>
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl"><Users className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">עמלות סוכן</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalAgentCommission)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl"><Building2 className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">עמלות משרד</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalOfficeCommission)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-xl"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">סה"כ הוצאות</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalMonthExpenses)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-xl"><DollarSign className="w-5 h-5 text-purple-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">סה"כ עמלות</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalAgentCommission)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">יתרה לתשלום</p>
                    <p className="text-2xl font-bold">{formatCurrency(Math.max(0, totalAgentCommission - totalPaidToAgent))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl"><DollarSign className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">סה"כ שולם</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalPaidToAgent)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* גרף עמלות חודשי */}
      {hasChartData && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4">עמלות — 6 חודשים אחרונים</h2>
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyChart} margin={{ top: 0, right: 45, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} width={55} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip formatter={(v, name) => name === 'עמלות' ? formatCurrency(v) : v} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="עמלות" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="עסקאות" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* גרף לפי סוכן — מנהל */}
      {isAdminView && agentChart.length > 1 && (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4">עמלות לפי סוכן (כולל)</h2>
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agentChart} margin={{ top: 0, right: 45, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} width={55} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip formatter={(v, name) => name === 'עמלה' ? formatCurrency(v) : v} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="עמלה" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="עסקאות" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent deals */}
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">עסקאות אחרונות</h2>
            <Link to={dealsPath} className="text-sm text-primary hover:underline">כל העסקאות</Link>
          </div>
        </CardContent>
        {deals.slice(0, 5).length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-sm">אין עסקאות עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">לקוח</TableHead>
                  {isAdminView && <TableHead className="text-right">סוכן</TableHead>}
                  <TableHead className="text-right">עמלה</TableHead>
                  <TableHead className="text-right">עמלת סוכן</TableHead>
                  {isAdminView && <TableHead className="text-right">עמלת משרד</TableHead>}
                  <TableHead className="text-right">סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.slice(0, 5).map(d => {
                  const st = DEAL_STATUS_MAP[d.status] || DEAL_STATUS_MAP['פתוחה'];
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">{d.month || '-'}</TableCell>
                      <TableCell className="font-medium text-sm">
                        {d.client_name}
                        {d.address ? <span className="block text-xs text-muted-foreground">{d.address}</span> : null}
                      </TableCell>
                      {isAdminView && <TableCell className="text-sm">{d.agent_name || '-'}</TableCell>}
                      <TableCell className="text-sm font-semibold">{formatCurrency(d.commission_amount)}</TableCell>
                      <TableCell className="text-sm text-emerald-700">{formatCurrency(d.agent_commission)}</TableCell>
                      {isAdminView && <TableCell className="text-sm text-primary font-medium">{formatCurrency(d.office_commission)}</TableCell>}
                      <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Agent: הכנסות אחרונות */}
      {!isAdminView && (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-5 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">הכנסות אחרונות</h2>
              <Link to={reportsPath} className="text-sm text-primary hover:underline">כל ההכנסות</Link>
            </div>
          </CardContent>
          {deals.slice(0, 5).length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">אין הכנסות עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">חודש</TableHead>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">סכום עסקה</TableHead>
                    <TableHead className="text-right">עמלה</TableHead>
                    <TableHead className="text-right">עמלת סוכן</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.slice(0, 5).map(d => {
                    const st = DEAL_STATUS_MAP[d.status] || DEAL_STATUS_MAP['פתוחה'];
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{d.month || '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{d.client_name}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(d.deal_amount)}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(d.commission_amount)}</TableCell>
                        <TableCell className="text-sm text-emerald-700">{formatCurrency(d.agent_commission)}</TableCell>
                        <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Agent: הוצאות אחרונות */}
      {!isAdminView && (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-5 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">הוצאות אחרונות</h2>
              <Link to={expensesPath} className="text-sm text-primary hover:underline">כל ההוצאות</Link>
            </div>
          </CardContent>
          {expenses.filter(e => e.status !== 'gmail_inbox').slice(0, 5).length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">אין הוצאות עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.filter(e => e.status !== 'gmail_inbox').slice(0, 5).map(e => {
                    const st = STATUS_MAP[e.status] || STATUS_MAP.pending_approval;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{e.date ? format(new Date(e.date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{e.vendor_name || '-'}</TableCell>
                        <TableCell className="font-semibold text-sm">{formatCurrency(e.total_amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.category || '-'}</TableCell>
                        <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Admin: הכנסות אחרונות */}
      {isAdminView && (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-5 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">הכנסות אחרונות</h2>
              <Link to={reportsPath} className="text-sm text-primary hover:underline">כל ההכנסות</Link>
            </div>
          </CardContent>
          {allDeals.slice(0, 5).length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">אין עסקאות עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">חודש</TableHead>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">סוכן</TableHead>
                    <TableHead className="text-right">סכום עסקה</TableHead>
                    <TableHead className="text-right">עמלה</TableHead>
                    <TableHead className="text-right">עמלת סוכן</TableHead>
                    <TableHead className="text-right">עמלת משרד</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDeals.slice(0, 5).map(d => {
                    const st = DEAL_STATUS_MAP[d.status] || DEAL_STATUS_MAP['פתוחה'];
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{d.month || '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{d.client_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.agent_name || '-'}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(d.deal_amount)}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(d.commission_amount)}</TableCell>
                        <TableCell className="text-sm text-emerald-700">{formatCurrency(d.agent_commission)}</TableCell>
                        <TableCell className="text-sm text-primary font-medium">{formatCurrency(d.office_commission)}</TableCell>
                        <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Admin: הוצאות אחרונות */}
      {isAdminView && (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-5 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">הוצאות אחרונות</h2>
              <Link to={expensesPath} className="text-sm text-primary hover:underline">כל ההוצאות</Link>
            </div>
          </CardContent>
          {regularExpenses.slice(0, 5).length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">אין הוצאות עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">סוכן</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">קבלה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularExpenses.slice(0, 5).map(e => {
                    const st = STATUS_MAP[e.status] || STATUS_MAP.pending_approval;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{e.date ? format(new Date(e.date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell className="font-medium text-sm">{e.vendor_name || '-'}</TableCell>
                        <TableCell className="font-semibold text-sm">{formatCurrency(e.total_amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.category || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.agent_name || '-'}</TableCell>
                        <TableCell><Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge></TableCell>
                        <TableCell>
                          {e.has_receipt
                            ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">יש</Badge>
                            : <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">חסרה</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
