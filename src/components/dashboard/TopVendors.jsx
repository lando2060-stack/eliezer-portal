import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';

export default function TopVendors({ expenses }) {
  const vendorTotals = {};
  expenses.forEach(e => {
    if (e.vendor_name) {
      vendorTotals[e.vendor_name] = (vendorTotals[e.vendor_name] || 0) + (e.total_amount || 0);
    }
  });

  const topVendors = Object.entries(vendorTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6);

  const maxAmount = topVendors[0]?.[1] || 1;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">ספקים מובילים</CardTitle>
      </CardHeader>
      <CardContent>
        {topVendors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>
        ) : (
          <div className="space-y-3">
            {topVendors.map(([vendor, total]) => (
              <div key={vendor} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{vendor}</span>
                  <span className="text-muted-foreground">{formatCurrency(total)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-primary to-primary/60 rounded-full transition-all duration-500"
                    style={{ width: `${(total / maxAmount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}