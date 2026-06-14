import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, RefreshCw, Building2, Tag, Pencil, Mail, HardDrive, LogOut, User, KeyRound, Loader2, MapPin, CheckCircle2, Clock, UserCheck, Shield, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsAdminView } from '@/hooks/useIsAdminView';
import { supabase } from '@/lib/supabase';

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

// ---- Areas Settings Tab (admin only) ----
function AreasSettingsTab() {
  const [areas, setAreas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('app_areas') || '["תל אביב","ירושלים","חיפה","הרצליה","רמת גן","פתח תקווה","ראשון לציון","נתניה"]'); } catch { return []; }
  });
  const [newArea, setNewArea] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState('');

  const save = (list) => { setAreas(list); localStorage.setItem('app_areas', JSON.stringify(list)); };
  const add = () => { if (!newArea.trim()) return; save([...areas, newArea.trim()]); setNewArea(''); toast.success('האזור נוסף'); };
  const remove = (i) => { if (window.confirm(`למחוק את "${areas[i]}"?`)) save(areas.filter((_, idx) => idx !== i)); };
  const saveEdit = () => { const a = [...areas]; a[editIdx] = editVal.trim(); save(a); setEditIdx(null); };

  return (
    <div className="space-y-4 max-w-md">
      <div className="flex gap-2">
        <Input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="שם אזור חדש" onKeyDown={e => e.key === 'Enter' && add()} className="rounded-xl" />
        <Button onClick={add} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> הוסף</Button>
      </div>
      <div className="space-y-2">
        {areas.map((area, i) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
            {editIdx === i ? (
              <>
                <Input value={editVal} onChange={e => setEditVal(e.target.value)} className="flex-1 h-8" autoFocus />
                <Button size="sm" onClick={saveEdit}>שמור</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)}>ביטול</Button>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm">{area}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditIdx(i); setEditVal(area); }}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Catalog Tab (Categories + Areas combined) ----
function CatalogTab() {
  const [activeTab, setActiveTab] = useState('categories');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setActiveTab('categories')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'categories' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>קטגוריות</button>
        <button onClick={() => setActiveTab('areas')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'areas' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>אזורים</button>
      </div>
      {activeTab === 'categories' ? <CategoriesTab /> : <AreasSettingsTab />}
    </div>
  );
}

// ---- Integrations Tab ----
function IntegrationsTab() {

  // Gmail state
  const [gmailStatus, setGmailStatus] = useState(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [driveStatus, setDriveStatus] = useState(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveDisconnecting, setDriveDisconnecting] = useState(false);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      toast.success('Gmail חובר בהצלחה!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('drive') === 'connected') {
      toast.success('Google Drive חובר בהצלחה!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('drive') === 'error' || params.get('gmail') === 'error') {
      toast.error('שגיאה בחיבור Google');
      window.history.replaceState({}, '', window.location.pathname);
    }

    const headers$ = getAuthHeaders();

    headers$.then(headers =>
      fetch('/api/google/status?service=gmail', { headers })
        .then(r => r.json())
        .then(data => setGmailStatus(data))
        .catch(() => setGmailStatus({ connected: false }))
        .finally(() => setGmailLoading(false))
    );

    headers$.then(headers =>
      fetch('/api/google/status?service=drive', { headers })
        .then(r => r.json())
        .then(data => setDriveStatus(data))
        .catch(() => setDriveStatus({ connected: false }))
        .finally(() => setDriveLoading(false))
    );
  }, []);

  const connectGmail = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/google/auth-url?service=gmail', { headers });
    const { url, error } = await res.json();
    if (error || !url) {
      // Fallback to legacy endpoint
      const res2 = await fetch('/api/google/auth-url', { headers });
      const d2 = await res2.json();
      if (d2.url) { window.location.href = d2.url; return; }
      toast.error('שגיאה ביצירת קישור התחברות');
      return;
    }
    window.location.href = url;
  };

  const connectDrive = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/google/auth-url?service=drive', { headers });
    const { url, error } = await res.json();
    if (error || !url) {
      const res2 = await fetch('/api/google/auth-url', { headers });
      const d2 = await res2.json();
      if (d2.url) { window.location.href = d2.url; return; }
      toast.error('שגיאה ביצירת קישור התחברות');
      return;
    }
    window.location.href = url;
  };

  const disconnectGmail = async () => {
    if (!window.confirm('לנתק את Gmail?')) return;
    setGmailDisconnecting(true);
    const headers = await getAuthHeaders();
    await fetch('/api/google/disconnect?service=gmail', { method: 'POST', headers });
    setGmailStatus({ connected: false });
    setGmailDisconnecting(false);
    toast.success('Gmail נותק');
  };

  const disconnectDrive = async () => {
    if (!window.confirm('לנתק את Google Drive?')) return;
    setDriveDisconnecting(true);
    const headers = await getAuthHeaders();
    await fetch('/api/google/disconnect?service=drive', { method: 'POST', headers });
    setDriveStatus({ connected: false });
    setDriveDisconnecting(false);
    toast.success('Google Drive נותק');
  };

  const handleScanGmail = async () => {
    setScanning(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/google/scan-gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בסריקה');
      if (data.created > 0) {
        toast.success(`נמצאו ${data.found} מיילים — ${data.created} חשבוניות נוספו (עמוד הוצאות → חשבוניות ממייל)`);
      } else if (data.found > 0) {
        toast.info(`נמצאו ${data.found} מיילים אך לא זוהו קבצים חדשים`);
      } else {
        toast.info('לא נמצאו קבלות חדשות במייל (30 ימים אחרונים)');
      }
    } catch (err) {
      toast.error(err.message || 'שגיאה בסריקת Gmail');
    } finally {
      setScanning(false);
    }
  };

  const GoogleIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  return (
    <div className="space-y-4 max-w-xl">

      {/* Gmail Card */}
      <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Gmail</span>
                    {gmailLoading ? (
                      <span className="text-xs text-muted-foreground">בודק...</span>
                    ) : gmailStatus?.connected ? (
                      <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">מחובר</span>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">לא מחובר</span>
                    )}
                  </div>
                  {gmailStatus?.connected ? (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{gmailStatus.email}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">סריקת חשבוניות ממייל אוטומטית</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {gmailStatus?.connected && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={handleScanGmail} disabled={scanning}>
                    {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {scanning ? 'סורק...' : 'סרוק'}
                  </Button>
                )}
                {gmailStatus?.connected ? (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                    onClick={disconnectGmail} disabled={gmailDisconnecting}>
                    נתק
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="gap-2" onClick={connectGmail} disabled={gmailLoading}>
                    <GoogleIcon /> התחבר
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
      </Card>

      {/* Google Drive Card */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Google Drive</span>
                  {driveLoading ? (
                    <span className="text-xs text-muted-foreground">בודק...</span>
                  ) : driveStatus?.connected ? (
                    <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">מחובר</span>
                  ) : (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">לא מחובר</span>
                  )}
                </div>
                {driveStatus?.connected ? (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{driveStatus.email}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">גיבוי קבלות אוטומטי לדרייב</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {driveStatus?.connected && driveStatus.folderUrl && (
                <a href={driveStatus.folderUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  פתח תיקייה ↗
                </a>
              )}
              {driveStatus?.connected ? (
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  onClick={disconnectDrive} disabled={driveDisconnecting}>
                  נתק
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-2" onClick={connectDrive} disabled={driveLoading}>
                  <GoogleIcon /> התחבר
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

// ---- Agent Permissions Tab (admin only) ----
const AGENT_PERMISSION_DEFS = [
  { key: 'can_connect_email', label: 'חיבור מייל אישי', desc: 'יכול לחבר את ה-Gmail שלו' },
  { key: 'can_add_deal', label: 'הוספת עסקה', desc: 'יכול לפתוח עסקה חדשה' },
  { key: 'can_add_expense', label: 'הוספת הוצאה', desc: 'יכול להוסיף הוצאה' },
  { key: 'can_add_income', label: 'הוספת הכנסה', desc: 'יכול לרשום הכנסה' },
];
const PERM_DEFAULTS = { can_connect_email: true, can_add_deal: true, can_add_expense: true, can_add_income: true };

function AgentPermissionsTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');

  // ── Pending approvals ──
  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ['pending-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, is_approved')
        .eq('is_approved', false)
        .eq('role', 'agent');
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (profile) => {
      const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', profile.id);
      if (error) throw error;

      // Create agents record if not already linked
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!existingAgent) {
        const { error: agentError } = await supabase.from('agents').insert({
          name: profile.full_name || '',
          email: '',
          phone: profile.phone || '',
          commission_percent: 50,
          is_active: true,
          user_id: profile.id,
          notes: '',
          permissions: {},
        });
        if (agentError) throw agentError;
      }

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: profile.email, type: 'agent_approved', data: { name: profile.full_name } }),
        });
      } catch { /* non-fatal */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent-profiles'] });
      toast.success('הסוכן אושר בהצלחה');
    },
    onError: () => toast.error('שגיאה באישור הסוכן'),
  });

  // ── Add admin ──
  const { data: agentProfiles = [], isLoading: loadingAgentProfiles } = useQuery({
    queryKey: ['agent-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, email, phone, user_id');
      if (error) throw error;
      const agents = data || [];

      const userIds = agents.filter(a => a.user_id).map(a => a.user_id);
      if (userIds.length === 0) return agents.map(a => ({ ...a, role: null }));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, role')
        .in('id', userIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      return agents.map(a => ({
        ...a,
        role: a.user_id ? (profileMap[a.user_id]?.role || 'agent') : null,
      }));
    },
  });

  const promoteAdminMutation = useMutation({
    mutationFn: async (agent) => {
      const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', agent.user_id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agent-profiles'] }); toast.success('הסוכן הפך למנהל'); },
    onError: () => toast.error('שגיאה בשינוי הרשאה'),
  });

  const demoteMutation = useMutation({
    mutationFn: async (agent) => {
      const { error } = await supabase.from('profiles').update({ role: 'agent' }).eq('id', agent.user_id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agent-profiles'] }); toast.success('ההרשאה שונתה לסוכן'); },
    onError: () => toast.error('שגיאה בשינוי הרשאה'),
  });

  // ── Agent permissions ──
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const [savingPerm, setSavingPerm] = useState(null); // "agentId:permKey"

  const togglePerm = async (agent, key) => {
    const token = `${agent.id}:${key}`;
    if (savingPerm) return;
    const current = { ...PERM_DEFAULTS, ...(agent.permissions || {}) };
    const next = { ...current, [key]: !current[key] };
    setSavingPerm(token);
    try {
      await base44.entities.Agent.update(agent.id, { permissions: next });
      queryClient.setQueryData(['agents'], (old) =>
        old?.map(a => a.id === agent.id ? { ...a, permissions: next } : a) ?? []
      );
    } catch {
      toast.error('שגיאה בשמירת ההרשאה');
    } finally {
      setSavingPerm(null);
    }
  };

  const tabs = [
    { key: 'pending', label: 'ממתינים לאישור', badge: pending.length },
    { key: 'admins', label: 'הוספת מנהל' },
    { key: 'perms', label: 'הרשאות סוכנים' },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
            {t.badge > 0 && <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Pending approvals */}
      {activeTab === 'pending' && (
        loadingPending ? <div className="text-center py-12 text-muted-foreground">טוען...</div>
        : pending.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
            <p className="font-medium">אין סוכנים ממתינים לאישור</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              {pending.length} סוכנים ממתינים לאישור גישה
            </p>
            {pending.map(p => (
              <Card key={p.id} className="rounded-2xl border-amber-200 bg-amber-50/50">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-xl"><UserCheck className="w-5 h-5 text-amber-600" /></div>
                    <div>
                      <p className="font-semibold">{p.full_name || 'ללא שם'}</p>
                      <p className="text-sm text-muted-foreground">{p.phone || ''}</p>
                    </div>
                  </div>
                  <Button size="sm" className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => approveMutation.mutate(p)} disabled={approveMutation.isPending}>
                    <CheckCircle2 className="w-4 h-4" /> אשר גישה
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Add / manage admins */}
      {activeTab === 'admins' && (
        loadingAgentProfiles ? <div className="text-center py-12 text-muted-foreground">טוען...</div>
        : agentProfiles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium">אין סוכנים במערכת</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">הפוך סוכן למנהל — המנהל יקבל גישה מלאה למערכת</p>
            {agentProfiles.map(p => (
              <Card key={p.id} className="rounded-2xl">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-xl"><Shield className="w-5 h-5 text-purple-600" /></div>
                    <div>
                      <p className="font-semibold">{p.name || 'ללא שם'}</p>
                      <p className="text-xs text-muted-foreground">{p.email || p.phone || ''}</p>
                      {p.role === 'admin' && (
                        <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200 mt-0.5">מנהל</Badge>
                      )}
                    </div>
                  </div>
                  {p.user_id ? (
                    p.role === 'admin' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-xl text-muted-foreground"
                        onClick={() => {
                          if (window.confirm(`להחזיר את "${p.name}" לסוכן רגיל?`))
                            demoteMutation.mutate(p);
                        }}
                        disabled={demoteMutation.isPending}
                      >
                        הורד לסוכן
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-xl border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={() => {
                          if (window.confirm(`להפוך את "${p.name}" למנהל? הוא יקבל גישה מלאה למערכת.`))
                            promoteAdminMutation.mutate(p);
                        }}
                        disabled={promoteAdminMutation.isPending}
                      >
                        <Shield className="w-4 h-4" /> הפוך למנהל
                      </Button>
                    )
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">אין חשבון</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Agent permissions */}
      {activeTab === 'perms' && (
        loadingAgents ? <div className="text-center py-12 text-muted-foreground">טוען...</div>
        : agents.filter(a => a.is_active).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-medium">אין סוכנים פעילים</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">הגדר מה כל סוכן יכול לעשות במערכת</p>
            {agents.filter(a => a.is_active).map(agent => {
              const perms = { ...PERM_DEFAULTS, ...(agent.permissions || {}) };
              return (
                <Card key={agent.id} className="rounded-2xl">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b">
                      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                        <span className="font-bold text-primary text-sm">{agent.name?.[0] || '?'}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email || 'אין מייל'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {AGENT_PERMISSION_DEFS.map(def => {
                        const token = `${agent.id}:${def.key}`;
                        const isSaving = savingPerm === token;
                        return (
                          <div key={def.key} className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{def.label}</p>
                              <p className="text-xs text-muted-foreground">{def.desc}</p>
                            </div>
                            <Switch
                              checked={perms[def.key]}
                              onCheckedChange={() => togglePerm(agent, def.key)}
                              disabled={!!savingPerm}
                              className={isSaving ? 'opacity-50' : ''}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ---- Settings Card Grid ----
const SETTINGS_SECTIONS = {
  integrations: {
    key: 'integrations',
    title: 'חיבורים',
    desc: 'Google Drive, Gmail',
    icon: Mail,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    adminOnly: false,
  },
  catalog: {
    key: 'catalog',
    title: 'קטגוריות ואזורים',
    desc: 'ניהול קטגוריות הוצאות ואזורי עסקאות',
    icon: Tag,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    adminOnly: true,
  },
};

// ---- Main Settings Page ----
export default function Settings() {
  const { user } = useCurrentUser();
  const admin = useIsAdminView();
  const [activeSection, setActiveSection] = useState(null);
  const [agentPerms, setAgentPerms] = useState({ can_connect_email: true });

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    supabase.from('agents').select('permissions').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.permissions) setAgentPerms(p => ({ ...p, ...data.permissions }));
      })
      .catch(() => {});
  }, [user]);

  const visibleSections = Object.values(SETTINGS_SECTIONS).filter(s => !s.adminOnly || admin);
  const current = activeSection ? SETTINGS_SECTIONS[activeSection] : null;

  if (current) {
    const Icon = current.icon;
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => setActiveSection(null)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-4 transition-colors"
          >
            <span className="text-base leading-none">›</span> הגדרות
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${current.iconBg}`}>
              <Icon className={`w-5 h-5 ${current.iconColor}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{current.title}</h1>
              <p className="text-sm text-muted-foreground">{current.desc}</p>
            </div>
          </div>
        </div>

        {activeSection === 'integrations' && <IntegrationsTab />}
        {activeSection === 'catalog' && admin && <CatalogTab />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-muted-foreground mt-1">הגדרות מערכת ובית כנסת</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleSections.map(section => {
          const Icon = section.icon;
          return (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className="bg-white border border-border rounded-2xl p-6 text-right hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${section.iconBg} group-hover:scale-105 transition-transform`}>
                <Icon className={`w-6 h-6 ${section.iconColor}`} />
              </div>
              <p className="font-bold text-base">{section.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{section.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}