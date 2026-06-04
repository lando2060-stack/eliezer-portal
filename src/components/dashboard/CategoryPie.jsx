import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/constants';

export default function CategoryPie({ expenses, categories }) {
  const categoryMap = {};
  expenses.forEach(e => {
    if (e.category) {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + (e.total_amount || 0);
    }
  });

  const data = Object.entries(categoryMap)
    .map(([name, value]) => {
      const cat = categories.find(c => c.name === name);
      return { name, value, color: cat?.color || '#9ca3af' };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (data.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle className="text-lg font-semibold">חלוקה לפי קטגוריות</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          אין נתונים להצגה
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">חלוקה לפי קטגוריות</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="h-56 w-56 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2 w-full">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}