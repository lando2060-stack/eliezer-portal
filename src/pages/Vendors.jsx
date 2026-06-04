import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Building2 } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';

export default function Vendors() {
  const [search, setSearch] = useState('');
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list('-total_expenses', 200),
  });

  const filtered = vendors.filter(v => !search || v.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ספקים</h1>
        <p className="text-muted-foreground text-sm mt-1">{vendors.length} ספקים במערכת</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="חיפוש ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">ספק</TableHead>
              <TableHead className="text-right">ח.פ.</TableHead>
              <TableHead className="text-right">קטגוריה</TableHead>
              <TableHead className="text-right">מספר קבלות</TableHead>
              <TableHead className="text-right">סה״כ הוצאות</TableHead>
              <TableHead className="text-right">סכום ממוצע</TableHead>
              <TableHead className="text-right">הוצאה אחרונה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">לא נמצאו ספקים</TableCell></TableRow>
            ) : (
              filtered.map(vendor => (
                <TableRow key={vendor.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      {vendor.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{vendor.tax_id || '-'}</TableCell>
                  <TableCell>{vendor.default_category ? <Badge variant="secondary">{vendor.default_category}</Badge> : '-'}</TableCell>
                  <TableCell>{vendor.receipt_count || 0}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(vendor.total_expenses)}</TableCell>
                  <TableCell>{formatCurrency(vendor.average_amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {vendor.last_expense_date ? format(new Date(vendor.last_expense_date), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}