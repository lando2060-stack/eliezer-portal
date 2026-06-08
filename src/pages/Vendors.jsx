import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { formatCurrency, STATUS_MAP } from '@/lib/constants';
import { format } from 'date-fns';

function VendorRow({ vendor, expenses }) {
  const [expanded, setExpanded] = useState(false);

  const vendorExpenses = useMemo(
    () => expenses.filter(e => e.vendor_name === vendor.name && e.status !== 'gmail_inbox'),
    [expenses, vendor.name]
  );

  const total = vendorExpenses.reduce((s, e) => s + (e.total_amount || 0), 0);

  return (
    <>
      <TableRow
        className="hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            {vendor.name}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">{vendor.tax_id || '-'}</TableCell>
        <TableCell>{vendor.default_category ? <Badge variant="secondary">{vendor.default_category}</Badge> : '-'}</TableCell>
        <TableCell className="text-sm">{vendorExpenses.length}</TableCell>
        <TableCell className="font-semibold">{formatCurrency(total)}</TableCell>
        <TableCell className="text-sm">{formatCurrency(vendorExpenses.length ? total / vendorExpenses.length : 0)}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {vendor.last_expense_date ? format(new Date(vendor.last_expense_date), 'dd/MM/yyyy') : '-'}
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="p-0 bg-muted/20">
            {vendorExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">אין הוצאות רשומות לספק זה</p>
            ) : (
              <div className="px-4 py-3">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-right text-xs">תאריך</TableHead>
                      <TableHead className="text-right text-xs">קטגוריה</TableHead>
                      <TableHead className="text-right text-xs">סכום</TableHead>
                      <TableHead className="text-right text-xs">סטטוס</TableHead>
                      <TableHead className="text-right text-xs">סוכן</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorExpenses.map(e => {
                      const st = STATUS_MAP[e.status] || STATUS_MAP.pending_approval;
                      return (
                        <TableRow key={e.id} className="bg-white/60">
                          <TableCell className="text-xs py-2">{e.date ? format(new Date(e.date), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell className="text-xs py-2">{e.category || '-'}</TableCell>
                          <TableCell className="text-xs py-2 font-semibold">{formatCurrency(e.total_amount, e.currency)}</TableCell>
                          <TableCell className="py-2">
                            <Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs py-2 text-muted-foreground">{e.agent_name || '-'}</TableCell>
                          <TableCell className="py-2">
                            {e.receipt_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={ev => { ev.stopPropagation(); window.open(e.receipt_url, '_blank'); }}>
                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground text-end pt-2 pb-1">
                  סה״כ: <strong>{formatCurrency(total)}</strong>
                </p>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function Vendors() {
  const [search, setSearch] = useState('');

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list('-total_expenses', 200),
  });
  const { data: allExpenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date', 500),
  });

  const isLoading = vendorsLoading || expensesLoading;

  const filtered = vendors.filter(v => !search || v.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ספקים</h1>
        <p className="text-muted-foreground text-sm mt-1">{vendors.length} ספקים במערכת — לחץ על שורה להצגת הוצאות</p>
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
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">לא נמצאו ספקים</TableCell></TableRow>
            ) : (
              filtered.map(vendor => (
                <VendorRow key={vendor.id} vendor={vendor} expenses={allExpenses} />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
