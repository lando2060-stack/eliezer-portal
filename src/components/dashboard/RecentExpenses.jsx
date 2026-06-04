import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, STATUS_MAP } from '@/lib/constants';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function RecentExpenses({ expenses }) {
  const recent = expenses.slice(0, 8);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">קבלות אחרונות</CardTitle>
        <Link to="/expenses" className="text-sm text-primary hover:underline flex items-center gap-1">
          הצג הכל <ArrowLeft className="w-4 h-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין הוצאות עדיין</p>
        ) : (
          <div className="space-y-3">
            {recent.map((expense) => {
              const status = STATUS_MAP[expense.status] || STATUS_MAP.pending_approval;
              return (
                <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <p className="font-medium text-sm truncate">{expense.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : ''} • {expense.category || 'ללא קטגוריה'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="secondary" className={`text-xs ${status.color}`}>
                      {status.label}
                    </Badge>
                    <span className="font-bold text-sm whitespace-nowrap">
                      {formatCurrency(expense.total_amount, expense.currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}