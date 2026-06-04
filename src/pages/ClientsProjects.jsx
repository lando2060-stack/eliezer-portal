import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, User, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function ClientsProjects() {
  const [editClient, setEditClient] = useState(null);
  const [editProject, setEditProject] = useState(null);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });

  const clientMutation = useMutation({
    mutationFn: (data) => data.id ? base44.entities.Client.update(data.id, data) : base44.entities.Client.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); toast.success('נשמר'); setEditClient(null); },
    onError: () => toast.error('שגיאה בשמירת הלקוח'),
  });

  const projectMutation = useMutation({
    mutationFn: (data) => data.id ? base44.entities.Project.update(data.id, data) : base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('נשמר'); setEditProject(null); },
    onError: () => toast.error('שגיאה בשמירת הפרויקט'),
  });

  const deleteClient = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); toast.success('נמחק'); },
    onError: () => toast.error('שגיאה במחיקת הלקוח'),
  });

  const deleteProject = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('נמחק'); },
    onError: () => toast.error('שגיאה במחיקת הפרויקט'),
  });

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">לקוחות ופרויקטים</h1>

      <Tabs defaultValue="clients">
        <TabsList className="rounded-xl">
          <TabsTrigger value="clients" className="gap-2"><User className="w-4 h-4" /> לקוחות ({clients.length})</TabsTrigger>
          <TabsTrigger value="projects" className="gap-2"><FolderOpen className="w-4 h-4" /> פרויקטים ({projects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4 mt-4">
          <Button onClick={() => setEditClient({})} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> לקוח חדש</Button>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(c => (
              <Card key={c.id} className="rounded-2xl group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.contact_email || c.phone || ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditClient(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(`למחוק את הלקוח "${c.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteClient.mutate(c.id); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4 mt-4">
          <Button onClick={() => setEditProject({})} className="gap-2 rounded-xl"><Plus className="w-4 h-4" /> פרויקט חדש</Button>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <Card key={p.id} className="rounded-2xl group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><FolderOpen className="w-5 h-5 text-primary" /></div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.client || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                        {p.status === 'active' ? 'פעיל' : p.status === 'completed' ? 'הושלם' : 'מושהה'}
                      </Badge>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditProject(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(`למחוק את הפרויקט "${p.name}"? פעולה זו אינה ניתנת לביטול.`)) deleteProject.mutate(p.id); }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Client Dialog */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editClient?.id ? 'עריכת לקוח' : 'לקוח חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>שם</Label><Input defaultValue={editClient?.name || ''} onChange={e => setEditClient(prev => ({...prev, name: e.target.value}))} /></div>
            <div className="space-y-1"><Label>אימייל</Label><Input defaultValue={editClient?.contact_email || ''} onChange={e => setEditClient(prev => ({...prev, contact_email: e.target.value}))} /></div>
            <div className="space-y-1"><Label>טלפון</Label><Input defaultValue={editClient?.phone || ''} onChange={e => setEditClient(prev => ({...prev, phone: e.target.value}))} /></div>
            <Button onClick={() => clientMutation.mutate(editClient)} className="w-full rounded-xl">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editProject?.id ? 'עריכת פרויקט' : 'פרויקט חדש'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>שם</Label><Input defaultValue={editProject?.name || ''} onChange={e => setEditProject(prev => ({...prev, name: e.target.value}))} /></div>
            <div className="space-y-1">
              <Label>לקוח</Label>
              <Select value={editProject?.client || ''} onValueChange={v => setEditProject(prev => ({...prev, client: v}))}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => projectMutation.mutate(editProject)} className="w-full rounded-xl">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}