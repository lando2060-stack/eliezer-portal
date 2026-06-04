import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#a855f7', '#3b82f6', '#84cc16', '#d946ef', '#0ea5e9', '#f43f5e', '#eab308', '#22c55e', '#dc2626', '#9ca3af'];

export default function Categories() {
  const [editCat, setEditCat] = useState(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const saveMutation = useMutation({
    mutationFn: () => editCat?.id
      ? base44.entities.Category.update(editCat.id, { name, color })
      : base44.entities.Category.create({ name, color, is_default: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success(editCat?.id ? 'עודכנה' : 'נוצרה'); setEditCat(null); },
    onError: () => toast.error('שגיאה בשמירת הקטגוריה'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Category.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success('נמחקה'); },
    onError: () => toast.error('שגיאה במחיקת הקטגוריה'),
  });

  const openEdit = (cat) => { setEditCat(cat || {}); setName(cat?.name || ''); setColor(cat?.color || COLORS[0]); };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">קטגוריות</h1>
          <p className="text-muted-foreground text-sm mt-1">ניהול קטגוריות הוצאות</p>
        </div>
        <Button onClick={() => openEdit(null)} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> קטגוריה חדשה
        </Button>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">קטגוריה</TableHead>
              <TableHead className="text-right">צבע</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : categories.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">אין קטגוריות</TableCell></TableRow>
            ) : categories.map(cat => (
              <TableRow key={cat.id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                      <Tag className="w-3.5 h-3.5" style={{ color: cat.color }} />
                    </div>
                    <span className="font-medium">{cat.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: cat.color }} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => { if (window.confirm(`למחוק את הקטגוריה "${cat.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteMutation.mutate(cat.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editCat} onOpenChange={() => setEditCat(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCat?.id ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>שם הקטגוריה</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>צבע</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`}
                    style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending} className="w-full rounded-xl">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
