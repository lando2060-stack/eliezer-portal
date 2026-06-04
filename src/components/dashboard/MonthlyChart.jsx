import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MONTHS_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export default function MonthlyChart({ expenses }) {
  const currentYear = new Date().getFullYear();
  
  const monthlyData = MONTHS_HE.map((name, idx) => {
    const total = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === currentYear && d.getMonth() === idx;
      })
      .reduce((sum, e) => sum + (e.total_amount || 0), 0);
    return { name, total };
  });

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">הוצאות חודשיות - {currentYear}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value) => [`₪${value.toLocaleString()}`, 'סה״כ']}
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 13 }}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}