import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency } from '@/lib/constants';
import { BarChart3, Users, Scale, MapPin, Handshake } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const formatShort = (v) => `₪${(v / 1000).toFixed(0)}k`;

export default function Statistics() {
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const { data: allDeals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 1000) });
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });

  const deals = useMemo(() => {
    if (!year || year === 'all') return allDeals;
    return allDeals.filter(d => d.month?.startsWith(year));
  }, [allDeals, year]);

  const years = useMemo(() => {
    const s = new Set(allDeals.map(d => d.month?.slice(0, 4)).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [allDeals]);

  // 1. עסקאות לפי צד
  const bySide = useMemo(() => {
    const map = {};
    deals.forEach(d => {
      const k = d.side || 'לא מוגדר';
      if (!map[k]) map[k] = { name: k, עסקאות: 0, עמלות: 0 };
      map[k].עסקאות++;
      map[k].עמלות += d.commission_amount || 0;
    });
    return Object.values(map).sort((a, b) => b.עסקאות - a.עסקאות);
  }, [deals]);

  // 2. שיתופי פעולה
  const cooperation = useMemo(() => {
    const coopDeals = deals.filter(d => d.cooperation_agent);
    const map = {};
    coopDeals.forEach(d => {
      const k = d.cooperation_agent;
      if (!map[k]) map[k] = { name: k, עסקאות: 0, עמלות: 0 };
      map[k].עסקאות++;
      map[k].עמלות += d.commission_amount || 0;
    });
    return Object.values(map).sort((a, b) => b.עסקאות - a.עסקאות);
  }, [deals]);

  // 3. עורכי דין
  const lawyers = useMemo(() => {
    const map = {};
    deals.filter(d => d.lawyer_name).forEach(d => {
      const k = d.lawyer_name;
      if (!map[k]) map[k] = { name: k, עסקאות: 0, עמלות: 0 };
      map[k].עסקאות++;
      map[k].עמלות += d.commission_amount || 0;
    });
    return Object.values(map).sort((a, b) => b.עסקאות - a.עסקאות);
  }, [deals]);

  // 4. איזורים
  const areas = useMemo(() => {
    const map = {};
    deals.forEach(d => {
      const k = d.area || 'לא מוגדר';
      if (!map[k]) map[k] = { name: k, עסקאות: 0, עמלות: 0 };
      map[k].עסקאות++;
      map[k].עמלות += d.commission_amount || 0;
    });
    return Object.values(map).sort((a, b) => b.עסקאות - a.עסקאות);
  }, [deals]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-primary" /> סטטיסטיקות</h1>
          <p className="text-muted-foreground text-sm mt-1">{deals.length} עסקאות בתקופה הנבחרת</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל השנים</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 1. עסקאות לפי צד */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> עסקאות לפי צד</CardTitle>
        </CardHeader>
        <CardContent>
          {bySide.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">אין נתונים</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {bySide.map((s, i) => (
                  <div key={s.name} className="p-3 bg-muted/50 rounded-xl text-center">
                    <Badge variant="secondary" className="mb-2 text-xs" style={{ background: COLORS[i] + '20', color: COLORS[i] }}>{s.name}</Badge>
                    <p className="text-2xl font-bold">{s.עסקאות}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(s.עמלות)}</p>
                  </div>
                ))}
              </div>
              <div style={{ direction: 'ltr' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={bySide}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, name) => name === 'עמלות' ? formatCurrency(v) : v} />
                    <Legend />
                    <Bar dataKey="עסקאות" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. שיתופי פעולה */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Handshake className="w-4 h-4 text-emerald-500" /> שיתופי פעולה ({cooperation.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cooperation.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">אין שיתופי פעולה בתקופה זו</p>
          ) : (
            <div className="divide-y">
              {cooperation.map((c, i) => (
                <div key={c.name} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: COLORS[i % COLORS.length] }}>
                      {c.name[0]}
                    </div>
                    <span className="font-medium text-sm">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{c.עסקאות} עסקאות</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(c.עמלות)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. עורכי דין */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Scale className="w-4 h-4 text-purple-500" /> עורכי דין ({lawyers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lawyers.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">לא הוזנו עורכי דין</p>
          ) : (
            <div className="space-y-4">
              <div style={{ direction: 'ltr' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={lawyers.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="עסקאות" fill="#8b5cf6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. איזורים */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-500" /> איזורים ({areas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {areas.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">אין נתוני איזורים</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div style={{ direction: 'ltr' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={areas.slice(0, 6)} dataKey="עסקאות" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, עסקאות }) => `${name}: ${עסקאות}`}>
                      {areas.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {areas.map((a, i) => (
                  <div key={a.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium">{a.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold">{a.עסקאות}</span>
                      <span className="text-xs text-muted-foreground mr-2">{formatCurrency(a.עמלות)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
