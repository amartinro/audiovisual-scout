import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, RefreshCw } from 'lucide-react';
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
            Prompt de Generación de Email
          </CardTitle>
          <CardDescription>
            Personaliza el prompt que se usa para generar los emails comerciales.
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
            Configura el comportamiento de la búsqueda de negocios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-save">Guardar automáticamente como Lead</Label>
              <p className="text-sm text-muted-foreground">
                Al buscar, los negocios se guardarán automáticamente como leads
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

      {/* Save Button */}
      <Button onClick={guardarSettings} disabled={saving} className="w-full">
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Guardar Configuración
      </Button>
    </div>
  );
}
