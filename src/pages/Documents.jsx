import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, Download, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DOC_TYPES = {
  invoice: 'חשבונית', contract: 'חוזה', insurance_policy: 'פוליסת ביטוח',
  quote: 'הצעת מחיר', payment_confirmation: 'אישור תשלום', business_document: 'מסמך עסקי', other: 'אחר',
};

export default function Documents() {
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'other', vendor_name: '', notes: '', file_url: '' });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery({ queryKey: ['documents'], queryFn: () => base44.entities.Document.list('-created_date', 200) });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Document.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }); toast.success('המסמך נשמר'); setShowUpload(false); setForm({ name: '', type: 'other', vendor_name: '', notes: '', file_url: '' }); },
    onError: () => toast.error('שגיאה בשמירת המסמך'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }); toast.success('נמחק'); },
    onError: () => toast.error('שגיאה במחיקת המסמך'),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(prev => ({ ...prev, file_url, name: prev.name || file.name }));
    } catch {
      toast.error('שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
    }
  };

  const filtered = documents.filter(d => !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.vendor_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מרכז מסמכים</h1>
          <p className="text-muted-foreground text-sm mt-1">{documents.length} מסמכים</p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> מסמך חדש</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <Card key={doc.id} className="rounded-2xl group hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.vendor_name || ''}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">{DOC_TYPES[doc.type] || doc.type}</Badge>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">{doc.created_date ? format(new Date(doc.created_date), 'dd/MM/yyyy') : ''}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4" /></Button>
                    </a>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(`למחוק את המסמך "${doc.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteMutation.mutate(doc.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>העלאת מסמך</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full rounded-xl gap-2">
              <Upload className="w-4 h-4" /> {uploading ? 'מעלה...' : form.file_url ? 'קובץ הועלה ✓' : 'בחר קובץ'}
            </Button>
            <div className="space-y-1"><Label>שם המסמך</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
            <div className="space-y-1">
              <Label>סוג</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({...p, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>ספק</Label><Input value={form.vendor_name} onChange={e => setForm(p => ({...p, vendor_name: e.target.value}))} /></div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} className="w-full rounded-xl">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}