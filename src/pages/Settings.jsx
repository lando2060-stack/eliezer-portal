import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, RefreshCw, Building2, Tag, Pencil, Mail, HardDrive, LogOut, User, KeyRound, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isAdmin } from '@/lib/roles';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#a855f7', '#3b82f6', '#84cc16', '#d946ef', '#0ea5e9', '#f43f5e', '#eab308', '#22c55e', '#dc2626', '#9ca3af'];

// ---- Profile Tab ----
function ProfileTab() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    base44.auth.me().then(u => {
      if (!cancelled) {
        setUser(u);
        setFullName(u?.full_name || '');
        setPhone(u?.phone || '');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await base44.auth.updateMe({ phone, full_name: fullName });
      toast.success('הפרטים נשמרו');
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('הסיסמאות אינן תואמות'); return; }
    if (newPassword.length < 6) { toast.error('סיסמה חייבת להכיל לפחות 6 תווים'); return; }
    setSavingPassword(true);
    try {
      await base44.auth.loginViaEmailPassword(user.email, currentPassword);
      await base44.auth.updateMe({ password: newPassword });
      toast.success('הסיסמה שונתה בהצלחה');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch {
      toast.error('הסיסמה הנוכחית שגויה');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      {/* User Info */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> פרטי משתמש</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">שם מלא</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="שם מלא" className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">אימייל</Label>
            <p className="font-medium text-sm text-muted-foreground">{user?.email || '-'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">טלפון</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="050-0000000" className="rounded-xl" />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile} className="rounded-xl gap-2">
            שמור פרטים
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" /> החלפת סיסמה</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">סיסמה נוכחית</Label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">סיסמה חדשה</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">אימות סיסמה חדשה</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded-xl" />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword} variant="outline" className="rounded-xl gap-2">
            <KeyRound className="w-4 h-4" /> שנה סיסמה
          </Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card className="rounded-2xl border-destructive/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">יציאה מהמערכת</p>
            <p className="text-xs text-muted-foreground">תצא מהחשבון שלך</p>
          </div>
          <Button variant="destructive" className="rounded-xl gap-2" onClick={() => base44.auth.logout('/login')}>
            <LogOut className="w-4 h-4" /> יציאה
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Recurring Tab ----
function RecurringTab() {
  const queryClient = useQueryClient();
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring'], queryFn: () => base44.entities.RecurringExpense.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });

  const empty = { name: '', vendor_name: '', amount: '', category: '', payment_method: '', day_of_month: 1, is_active: true };
  const [newR, setNewR] = useState(empty);
  const [dialogOpen, setDialogOpen] = useState(false);

  const createR = useMutation({
    mutationFn: (d) => base44.entities.RecurringExpense.create({ ...d, amount: parseFloat(d.amount) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); toast.success('נוצרה הוצאה קבועה'); setNewR(empty); setDialogOpen(false); },
    onError: () => toast.error('שגיאה ביצירת הוצאה קבועה'),
  });
  const deleteR = useMutation({
    mutationFn: (id) => base44.entities.RecurringExpense.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring'] }); toast.success('נמחקה'); },
    onError: () => toast.error('שגיאה במחיקה'),
  });
  const toggleR = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.RecurringExpense.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
    onError: () => toast.error('שגיאה בעדכון הסטטוס'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> הוצאה קבועה חדשה</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>הוספת הוצאה קבועה</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">שם *</Label><Input value={newR.name} onChange={e => setNewR(p => ({ ...p, name: e.target.value }))} className="rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs">ספק</Label><Input value={newR.vendor_name} onChange={e => setNewR(p => ({ ...p, vendor_name: e.target.value }))} className="rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs">סכום *</Label><Input type="number" value={newR.amount} onChange={e => setNewR(p => ({ ...p, amount: e.target.value }))} className="rounded-xl" /></div>
            <div className="space-y-1">
              <Label className="text-xs">קטגוריה</Label>
              <Select value={newR.category} onValueChange={v => setNewR(p => ({ ...p, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אמצעי תשלום</Label>
              <Select value={newR.payment_method} onValueChange={v => setNewR(p => ({ ...p, payment_method: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">יום בחודש</Label><Input type="number" min="1" max="31" value={newR.day_of_month} onChange={e => setNewR(p => ({ ...p, day_of_month: parseInt(e.target.value) || 1 }))} className="rounded-xl" /></div>
            <Button onClick={() => createR.mutate(newR)} disabled={!newR.name || !newR.amount || createR.isPending} className="w-full gap-2 rounded-xl"><Plus className="w-4 h-4" /> הוסף</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="text-right">שם</TableHead>
            <TableHead className="text-right">ספק</TableHead>
            <TableHead className="text-right">סכום</TableHead>
            <TableHead className="text-right">קטגוריה</TableHead>
            <TableHead className="text-right">יום</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead className="text-right w-12"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {recurring.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">אין הוצאות קבועות</TableCell></TableRow>
            ) : recurring.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.vendor_name || '-'}</TableCell>
                <TableCell>₪{r.amount?.toLocaleString()}</TableCell>
                <TableCell>{r.category || '-'}</TableCell>
                <TableCell>{r.day_of_month}</TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={v => toggleR.mutate({ id: r.id, is_active: v })} /></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(`למחוק את "${r.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteR.mutate(r.id); }}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---- Vendors Tab ----
function VendorsTab() {
  const queryClient = useQueryClient();
  const { data: vendors = [], isLoading } = useQuery({ queryKey: ['vendors'], queryFn: () => base44.entities.Vendor.list('-total_expenses', 200) });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });
  const [editVendor, setEditVendor] = useState(null);
  const [form, setForm] = useState({ name: '', tax_id: '', default_category: '', address: '', phone: '' });

  const saveV = useMutation({
    mutationFn: () => editVendor?.id ? base44.entities.Vendor.update(editVendor.id, form) : base44.entities.Vendor.create(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast.success(editVendor?.id ? 'ספק עודכן' : 'ספק נוצר'); setEditVendor(null); },
    onError: () => toast.error('שגיאה בשמירת הספק'),
  });
  const deleteV = useMutation({
    mutationFn: (id) => base44.entities.Vendor.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast.success('ספק נמחק'); },
    onError: () => toast.error('שגיאה במחיקת הספק'),
  });

  const openEdit = (v) => {
    setEditVendor(v || {});
    setForm({ name: v?.name || '', tax_id: v?.tax_id || '', default_category: v?.default_category || '', address: v?.address || '', phone: v?.phone || '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openEdit(null)} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> ספק חדש</Button>
      </div>
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-muted/50">
            <TableHead className="text-right">ספק</TableHead>
            <TableHead className="text-right">ח.פ.</TableHead>
            <TableHead className="text-right">קטגוריה</TableHead>
            <TableHead className="text-right">טלפון</TableHead>
            <TableHead className="text-right w-20"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : vendors.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">אין ספקים</TableCell></TableRow>
            ) : vendors.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-primary" /></div>
                    {v.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{v.tax_id || '-'}</TableCell>
                <TableCell>{v.default_category ? <Badge variant="secondary">{v.default_category}</Badge> : '-'}</TableCell>
                <TableCell className="text-sm">{v.phone || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (window.confirm(`למחוק את הספק "${v.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteV.mutate(v.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editVendor} onOpenChange={() => setEditVendor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editVendor?.id ? 'עריכת ספק' : 'ספק חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">שם ספק *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">ח.פ. / עוסק מורשה</Label><Input value={form.tax_id} onChange={e => setForm(p => ({ ...p, tax_id: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label className="text-xs">קטגוריה ברירת מחדל</Label>
              <Select value={form.default_category} onValueChange={v => setForm(p => ({ ...p, default_category: v }))}>
                <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">טלפון</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">כתובת</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <Button onClick={() => saveV.mutate()} disabled={!form.name || saveV.isPending} className="w-full rounded-xl">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Categories Tab ----
function CategoriesTab() {
  const queryClient = useQueryClient();
  const [editCat, setEditCat] = useState(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });

  const saveC = useMutation({
    mutationFn: () => editCat?.id ? base44.entities.Category.update(editCat.id, { name, color }) : base44.entities.Category.create({ name, color, is_default: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success(editCat?.id ? 'קטגוריה עודכנה' : 'קטגוריה נוצרה'); setEditCat(null); },
    onError: () => toast.error('שגיאה בשמירת הקטגוריה'),
  });
  const deleteC = useMutation({
    mutationFn: (id) => base44.entities.Category.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success('קטגוריה נמחקה'); },
    onError: () => toast.error('שגיאה במחיקת הקטגוריה'),
  });

  const openEdit = (cat) => { setEditCat(cat || {}); setName(cat?.name || ''); setColor(cat?.color || COLORS[0]); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openEdit(null)} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> קטגוריה חדשה</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(cat => (
          <Card key={cat.id} className="rounded-2xl hover:shadow-md transition-shadow group">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                  <Tag className="w-4 h-4" style={{ color: cat.color }} />
                </div>
                <span className="font-medium">{cat.name}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (window.confirm(`למחוק את הקטגוריה "${cat.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteC.mutate(cat.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editCat} onOpenChange={() => setEditCat(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCat?.id ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>שם הקטגוריה</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>צבע</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <Button onClick={() => saveC.mutate()} disabled={!name || saveC.isPending} className="w-full rounded-xl">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Integrations Tab ----
function IntegrationsTab() {
  const [driveStatus, setDriveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/google/status')
      .then(r => r.json())
      .then(data => setDriveStatus(data))
      .catch(() => setDriveStatus({ connected: false }))
      .finally(() => setLoading(false));

    // Check URL params for connection result
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive') === 'connected') {
      toast.success('Google Drive חובר בהצלחה!');
      window.history.replaceState({}, '', '/settings');
    } else if (params.get('drive') === 'error') {
      toast.error('שגיאה בחיבור Google Drive');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleConnect = async () => {
    const res = await fetch('/api/google/auth-url');
    const { url } = await res.json();
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    if (!window.confirm('לנתק את Google Drive?')) return;
    setDisconnecting(true);
    await fetch('/api/google/disconnect', { method: 'POST' });
    setDriveStatus({ connected: false });
    setDisconnecting(false);
    toast.success('Google Drive נותק');
  };

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Google Drive */}
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  Google Drive
                  {loading ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">בודק...</Badge>
                  ) : driveStatus?.connected ? (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">מחובר</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">לא מחובר</Badge>
                  )}
                </div>
                {driveStatus?.connected ? (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm text-muted-foreground">{driveStatus.email}</p>
                    <a href={driveStatus.folderUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline">
                      פתח תיקיית קבלות ב-Drive ↗
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    כל קבלה שתועלה תישמר אוטומטית ב-Drive של החברה
                  </p>
                )}
              </div>
            </div>
            {driveStatus?.connected ? (
              <Button variant="outline" className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive hover:text-white"
                onClick={handleDisconnect} disabled={disconnecting}>
                נתק
              </Button>
            ) : (
              <Button className="rounded-xl gap-2" onClick={handleConnect} disabled={loading}>
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                התחבר עם Google
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gmail - future */}
      <Card className="rounded-2xl opacity-50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <Mail className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  Gmail
                  <Badge variant="outline" className="text-xs text-muted-foreground">בקרוב</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">סריקה אוטומטית של קבלות שמגיעות למייל</p>
              </div>
            </div>
            <Button disabled className="rounded-xl">חבר</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Invite User Tab (admin only) ----
function InviteTab() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await base44.users.inviteUser(email, role);
      toast.success(`הזמנה נשלחה ל-${email}`);
      setEmail('');
    } catch {
      toast.error('שגיאה בשליחת הזמנה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" /> הזמנת משתמש חדש</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">כתובת אימייל</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="agent@example.com" className="rounded-xl" /></div>
          <div className="space-y-1">
            <Label className="text-xs">תפקיד</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">סוכן</SelectItem>
                <SelectItem value="admin">מנהל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleInvite} disabled={!email || loading} className="w-full rounded-xl gap-2">
            <UserPlus className="w-4 h-4" /> שלח הזמנה
          </Button>
          <p className="text-xs text-muted-foreground">המשתמש יקבל מייל עם קישור לכניסה. לאחר הכניסה, חבר אותו לכרטיס סוכן בעמוד הסוכנים.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Main Settings Page ----
export default function Settings() {
  const { user } = useCurrentUser();
  const admin = isAdmin(user);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">הגדרות</h1>

      <Tabs defaultValue="profile">
        <TabsList className="rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="profile" className="gap-2 rounded-lg"><User className="w-4 h-4" /> פרופיל</TabsTrigger>
          {admin && <TabsTrigger value="invite" className="gap-2 rounded-lg"><UserPlus className="w-4 h-4" /> הזמנת משתמשים</TabsTrigger>}
          <TabsTrigger value="recurring" className="gap-2 rounded-lg"><RefreshCw className="w-4 h-4" /> הוצאות קבועות</TabsTrigger>
          {admin && <TabsTrigger value="vendors" className="gap-2 rounded-lg"><Building2 className="w-4 h-4" /> ספקים</TabsTrigger>}
          <TabsTrigger value="categories" className="gap-2 rounded-lg"><Tag className="w-4 h-4" /> קטגוריות</TabsTrigger>
          {admin && <TabsTrigger value="integrations" className="gap-2 rounded-lg"><Mail className="w-4 h-4" /> חיבורי Google</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-4"><ProfileTab /></TabsContent>
        {admin && <TabsContent value="invite" className="mt-4"><InviteTab /></TabsContent>}
        <TabsContent value="recurring" className="mt-4"><RecurringTab /></TabsContent>
        {admin && <TabsContent value="vendors" className="mt-4"><VendorsTab /></TabsContent>}
        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        {admin && <TabsContent value="integrations" className="mt-4"><IntegrationsTab /></TabsContent>}
      </Tabs>
    </div>
  );
}