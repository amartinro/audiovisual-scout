import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { UserSettings } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DEFAULT_PROMPT = `Genera un email comercial personalizado para {nombre}, un {categoria} ubicado en {ciudad}. 

Considera:
- Si es empresa grande: tono formal
- Si es empresa pequeña: tono cercano  
- Si es empresa mediana: tono profesional neutro

{carencias_digitales}

El email debe:
- Hacer referencia explícita al tipo de negocio
- Proponer servicios audiovisuales (fotografía, vídeo, contenido para redes)
- NO ser agresivo en ventas
- Ser único y diferente cada vez

Firma:
Alberto Martín
Fotografía y vídeo profesional
Web: https://tufotoyvideopromocional.es/
Instagram: https://www.instagram.com/amartinro/
Email: a.martinro@gmail.com
WhatsApp: +34 665 651 344`;

const CIUDADES_SALAMANCA = [
  'Salamanca',
  'Béjar',
  'Ciudad Rodrigo',
  'Santa Marta de Tormes',
  'Villares de la Reina',
  'Carbajosa de la Sagrada',
  'Peñaranda de Bracamonte',
  'Alba de Tormes',
  'Guijuelo',
  'Villamayor',
];

export default function Configuracion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [emailPrompt, setEmailPrompt] = useState(DEFAULT_PROMPT);
  const [autoSaveLeads, setAutoSaveLeads] = useState(true);
  const [defaultCiudad, setDefaultCiudad] = useState('Salamanca');
  
  // Delete data dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as UserSettings);
        setEmailPrompt(data.email_prompt);
        setAutoSaveLeads(data.auto_save_leads);
        setDefaultCiudad(data.default_ciudad);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const guardarSettings = async () => {
    if (!user) return;
    setSaving(true);

    try {
      if (settings) {
        // Update existing
        const { error } = await supabase
          .from('user_settings')
          .update({
            email_prompt: emailPrompt,
            auto_save_leads: autoSaveLeads,
            default_ciudad: defaultCiudad,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase.from('user_settings').insert({
          user_id: user.id,
          email_prompt: emailPrompt,
          auto_save_leads: autoSaveLeads,
          default_ciudad: defaultCiudad,
        });

        if (error) throw error;
      }

      toast({ title: '¡Configuración guardada!' });
      fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar la configuración',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetPrompt = () => {
    setEmailPrompt(DEFAULT_PROMPT);
    toast({ title: 'Prompt restaurado al valor por defecto' });
  };

  const handleDeleteAllData = async () => {
    if (!user?.email) return;
    
    setDeleteError('');
    setDeleting(true);

    try {
      // Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (signInError) {
        setDeleteError('Contraseña incorrecta');
        setDeleting(false);
        return;
      }

      // Delete all data in order (respecting foreign keys)
      await supabase.from('emails').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('leads').delete().eq('user_id', user.id);
      await supabase.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('user_settings').delete().eq('user_id', user.id);

      toast({ 
        title: '¡Datos eliminados!',
        description: 'Todos los leads, mensajes y configuración han sido borrados.'
      });
      
      setDeleteDialogOpen(false);
      setDeletePassword('');
      fetchSettings();
    } catch (error) {
      console.error('Error deleting data:', error);
      setDeleteError('Error al eliminar los datos');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Email Prompt */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Prompt de Generación de Mensajes
          </CardTitle>
          <CardDescription>
            Personaliza el prompt que se usa para generar los mensajes comerciales (Email/WhatsApp).
            Usa las variables: {'{nombre}'}, {'{categoria}'}, {'{ciudad}'}, {'{carencias_digitales}'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={emailPrompt}
            onChange={(e) => setEmailPrompt(e.target.value)}
            rows={18}
            className="font-mono text-sm"
          />
          <Button variant="outline" onClick={resetPrompt} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Restaurar Prompt por Defecto
          </Button>
        </CardContent>
      </Card>

      {/* Búsqueda Settings */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Opciones de Búsqueda</CardTitle>
          <CardDescription>
            Configura el comportamiento de la búsqueda de leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-save">Guardar automáticamente como Lead</Label>
              <p className="text-sm text-muted-foreground">
                Al buscar, los leads se guardarán automáticamente
              </p>
            </div>
            <Switch
              id="auto-save"
              checked={autoSaveLeads}
              onCheckedChange={setAutoSaveLeads}
            />
          </div>

          <div className="space-y-2">
            <Label>Ciudad por Defecto</Label>
            <select
              value={defaultCiudad}
              onChange={(e) => setDefaultCiudad(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {CIUDADES_SALAMANCA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="shadow-card border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zona de Peligro
          </CardTitle>
          <CardDescription>
            Acciones irreversibles que afectan a todos tus datos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Borrar todos los datos</p>
              <p className="text-sm text-muted-foreground">
                Elimina todos los leads, mensajes y configuración
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar Todo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={guardarSettings} disabled={saving} className="w-full">
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Guardar Configuración
      </Button>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar eliminación
            </DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos los leads, mensajes y tu configuración.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Introduce tu contraseña para confirmar</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Tu contraseña"
              />
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletePassword('');
                setDeleteError('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAllData}
              disabled={deleting || !deletePassword}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Eliminar Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
