import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Loader2, Send, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Lead, Business } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LeadWithBusiness extends Lead {
  business: Business;
}

export default function Emails() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadWithBusiness[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (leadId && leads.length > 0) {
      setSelectedLeadId(leadId);
    }
  }, [searchParams, leads]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, business:businesses(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedLeads = (data || []).map(lead => ({
        ...lead,
        etiquetas: lead.etiquetas || [],
        business: lead.business as Business
      })) as LeadWithBusiness[];

      setLeads(typedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const generarEmail = () => {
    if (!selectedLead) return;

    setGenerating(true);

    // Simulate email generation (placeholder for AI integration)
    setTimeout(() => {
      const business = selectedLead.business;
      const tono = business.tamano_estimado === 'grande' ? 'formal' : 
                   business.tamano_estimado === 'pequeno' ? 'cercano' : 'profesional';

      const saludo = tono === 'formal' ? 'Estimados señores' : 
                     tono === 'cercano' ? `Hola` : 'Buenos días';

      const carencias = !business.web 
        ? 'He notado que actualmente no cuentan con presencia web' 
        : 'Tras revisar su presencia digital';

      const asuntoGenerado = `Propuesta de servicios audiovisuales para ${business.nombre}`;
      const cuerpoGenerado = `${saludo},

Me pongo en contacto con ustedes desde ${business.nombre}, ${business.categoria.toLowerCase()} ubicado en ${business.ciudad}.

${carencias}, me gustaría ofrecerles mis servicios de fotografía y vídeo profesional para potenciar su imagen y presencia en redes sociales.

Ofrezco:
- Fotografía profesional de productos, instalaciones y equipo
- Vídeo promocional y contenido para redes sociales
- Grabación y emisión de eventos
- Gestión de contenido visual para Instagram y otras plataformas

Estaré encantado de concertar una reunión sin compromiso para conocer sus necesidades específicas.

Un cordial saludo,

Alberto Martín
Fotografía y vídeo profesional
Web: https://tufotoyvideopromocional.es/
Instagram: https://www.instagram.com/amartinro/
Email: a.martinro@gmail.com
WhatsApp: +34 665 651 344`;

      setAsunto(asuntoGenerado);
      setCuerpo(cuerpoGenerado);
      setGenerating(false);
      toast({ title: 'Email generado' });
    }, 1000);
  };

  const guardarBorrador = async () => {
    if (!selectedLead || !asunto || !cuerpo) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Completa el asunto y el cuerpo del email',
      });
      return;
    }

    try {
      const { error } = await supabase.from('emails').insert({
        lead_id: selectedLead.id,
        asunto,
        cuerpo,
        estado: 'borrador',
      });

      if (error) throw error;

      toast({
        title: '¡Borrador guardado!',
        description: 'Email guardado en la base de datos',
      });

      // Reset form
      setAsunto('');
      setCuerpo('');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el borrador',
      });
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
    <div className="space-y-6">
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          Genera emails personalizados para tus leads. El envío se realiza manualmente desde Gmail.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Selection */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Seleccionar Lead</CardTitle>
            <CardDescription>Elige el lead para el que generar el email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar lead..." />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.business?.nombre} - {lead.business?.ciudad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLead && (
              <div className="rounded-lg border p-4 space-y-2">
                <p className="font-semibold">{selectedLead.business?.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedLead.business?.categoria} • {selectedLead.business?.ciudad}
                </p>
                <p className="text-sm text-muted-foreground">
                  Score: {selectedLead.business?.potencial_score} • Tamaño: {selectedLead.business?.tamano_estimado}
                </p>
                {selectedLead.business?.web && (
                  <a href={selectedLead.business.web} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {selectedLead.business.web}
                  </a>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={generarEmail}
              disabled={!selectedLead || generating}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generar Email
            </Button>
          </CardContent>
        </Card>

        {/* Email Editor */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Editor de Email</CardTitle>
            <CardDescription>Revisa y edita el email antes de guardarlo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input
                placeholder="Asunto del email..."
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cuerpo</Label>
              <Textarea
                placeholder="Contenido del email..."
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={guardarBorrador}
                disabled={!asunto || !cuerpo}
              >
                <FileText className="mr-2 h-4 w-4" />
                Guardar Borrador
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
