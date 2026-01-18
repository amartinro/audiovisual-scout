import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Loader2, FileText, Sparkles, AlertTriangle, Globe, Phone, Instagram } from 'lucide-react';
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
import { ProgressDialog, ProgressStep } from '@/components/ui/progress-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

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

  const updateStep = (stepId: string, updates: Partial<ProgressStep>) => {
    setProgressSteps(prev => prev.map(s => 
      s.id === stepId ? { ...s, ...updates } : s
    ));
  };

  const analizarNegocio = async (business: Business): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-business', {
        body: { business }
      });

      if (error) throw error;
      return data.analysis;
    } catch (error) {
      console.error('Error analyzing business:', error);
      return null;
    }
  };

  const generarEmailConIA = async (business: Business, notas: string | null): Promise<{ asunto: string; cuerpo: string } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: { business, notas }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating email:', error);
      return null;
    }
  };

  const analizarYGuardarMensaje = async () => {
    if (!selectedLead) return;

    const business = selectedLead.business;
    
    setGenerating(true);
    setProgressOpen(true);

    const initialSteps: ProgressStep[] = [
      { id: 'analyze', label: 'Analizando negocio...', status: 'pending', detail: 'Recopilando información del negocio' },
      { id: 'save-notes', label: 'Guardando análisis', status: 'pending', detail: 'Almacenando notas en la base de datos' },
      { id: 'generate', label: 'Generando mensaje de contacto', status: 'pending', detail: 'Redactando mensaje con IA' },
    ];

    setProgressSteps(initialSteps);

    try {
      // Step 1: Analyze
      updateStep('analyze', { status: 'loading', detail: `Analizando ${business.nombre}...` });
      
      const analysis = await analizarNegocio(business);
      
      if (!analysis) {
        updateStep('analyze', { status: 'error', detail: 'No se pudo analizar' });
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo analizar el negocio.',
        });
        return;
      }

      updateStep('analyze', { status: 'complete', detail: 'Análisis completado' });

      // Step 2: Save notes
      updateStep('save-notes', { status: 'loading', detail: 'Guardando en base de datos...' });
      
      const { error: updateError } = await supabase
        .from('leads')
        .update({ notas: analysis })
        .eq('id', selectedLead.id);

      if (updateError) {
        updateStep('save-notes', { status: 'error', detail: 'Error al guardar' });
        throw updateError;
      }

      updateStep('save-notes', { status: 'complete', detail: 'Notas guardadas' });

      // Update local state
      setLeads(prev => prev.map(l => 
        l.id === selectedLead.id ? { ...l, notas: analysis } : l
      ));

      // Step 3: Generate message
      updateStep('generate', { status: 'loading', detail: 'Redactando mensaje personalizado...' });
      
      const emailData = await generarEmailConIA(business, analysis);

      if (emailData) {
        updateStep('generate', { status: 'complete', detail: 'Mensaje generado' });
        setAsunto(emailData.asunto);
        setCuerpo(emailData.cuerpo);
        
        toast({ title: '¡Mensaje generado con éxito!' });
      } else {
        updateStep('generate', { status: 'error', detail: 'Error al generar mensaje' });
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo generar el mensaje. Inténtalo de nuevo.',
        });
      }
    } catch (error) {
      console.error('Error in message generation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error durante el proceso.',
      });
    } finally {
      setTimeout(() => {
        setProgressOpen(false);
        setGenerating(false);
      }, 1000);
    }
  };

  const generarEmail = async () => {
    if (!selectedLead) return;

    const business = selectedLead.business;

    // Check if business has email for sending
    if (!business.email) {
      toast({
        variant: 'destructive',
        title: 'Email requerido',
        description: 'Este negocio no tiene email asociado. Usa "Generar Mensaje" para crear un mensaje de contacto alternativo.',
      });
      return;
    }

    setGenerating(true);
    setProgressOpen(true);

    // Check if we need to analyze first
    const needsAnalysis = !selectedLead.notas;

    const initialSteps: ProgressStep[] = needsAnalysis
      ? [
          { id: 'analyze', label: 'Analizando negocio...', status: 'pending', detail: 'Recopilando información del negocio' },
          { id: 'save-notes', label: 'Guardando análisis', status: 'pending', detail: 'Almacenando notas en la base de datos' },
          { id: 'generate', label: 'Generando email personalizado', status: 'pending', detail: 'Redactando email con IA' },
        ]
      : [
          { id: 'generate', label: 'Generando email personalizado', status: 'pending', detail: 'Redactando email con IA' },
        ];

    setProgressSteps(initialSteps);

    try {
      let notas = selectedLead.notas;

      // Step 1: Analyze if needed
      if (needsAnalysis) {
        updateStep('analyze', { status: 'loading', detail: `Analizando ${business.nombre}...` });
        
        const analysis = await analizarNegocio(business);
        
        if (analysis) {
          updateStep('analyze', { status: 'complete', detail: 'Análisis completado' });
          notas = analysis;

          // Step 2: Save notes
          updateStep('save-notes', { status: 'loading', detail: 'Guardando en base de datos...' });
          
          const { error: updateError } = await supabase
            .from('leads')
            .update({ notas })
            .eq('id', selectedLead.id);

          if (updateError) {
            updateStep('save-notes', { status: 'error', detail: 'Error al guardar' });
            throw updateError;
          }

          updateStep('save-notes', { status: 'complete', detail: 'Notas guardadas' });

          // Update local state
          setLeads(prev => prev.map(l => 
            l.id === selectedLead.id ? { ...l, notas } : l
          ));
        } else {
          updateStep('analyze', { status: 'error', detail: 'No se pudo analizar' });
        }
      }

      // Step 3: Generate email
      updateStep('generate', { status: 'loading', detail: 'Redactando email personalizado...' });
      
      const emailData = await generarEmailConIA(business, notas);

      if (emailData) {
        updateStep('generate', { status: 'complete', detail: 'Email generado' });
        setAsunto(emailData.asunto);
        setCuerpo(emailData.cuerpo);
        
        toast({ title: '¡Email generado con éxito!' });
      } else {
        updateStep('generate', { status: 'error', detail: 'Error al generar email' });
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo generar el email. Inténtalo de nuevo.',
        });
      }
    } catch (error) {
      console.error('Error in email generation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error durante el proceso.',
      });
    } finally {
      // Keep dialog open briefly to show completion
      setTimeout(() => {
        setProgressOpen(false);
        setGenerating(false);
      }, 1000);
    }
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
      <ProgressDialog 
        open={progressOpen} 
        title="Generando Email" 
        steps={progressSteps} 
      />

      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          Genera emails personalizados para tus leads. El primer email analiza el negocio automáticamente.
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
                    <span className="flex items-center gap-2">
                      {lead.business?.nombre} - {lead.business?.ciudad}
                      {!lead.business?.email && (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLead && (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="font-semibold">{selectedLead.business?.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedLead.business?.categoria} • {selectedLead.business?.ciudad}
                </p>
                <p className="text-sm text-muted-foreground">
                  Score: {selectedLead.business?.potencial_score} • Tamaño: {selectedLead.business?.tamano_estimado}
                </p>
                
                {/* Contact Info */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {selectedLead.business?.web && (
                    <a href={selectedLead.business.web.startsWith('http') ? selectedLead.business.web : `https://${selectedLead.business.web}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs bg-success/10 text-success px-2 py-1 rounded hover:bg-success/20">
                      <Globe className="h-3 w-3 mr-1" /> Web
                    </a>
                  )}
                  {selectedLead.business?.telefono && (
                    <a href={`tel:${selectedLead.business.telefono}`} className="inline-flex items-center text-xs bg-info/10 text-info px-2 py-1 rounded hover:bg-info/20">
                      <Phone className="h-3 w-3 mr-1" /> {selectedLead.business.telefono}
                    </a>
                  )}
                  {selectedLead.business?.email && (
                    <a href={`mailto:${selectedLead.business.email}`} className="inline-flex items-center text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20">
                      <Mail className="h-3 w-3 mr-1" /> {selectedLead.business.email}
                    </a>
                  )}
                  {selectedLead.business?.redes_sociales?.instagram && (
                    <a href={selectedLead.business.redes_sociales.instagram.startsWith('http') ? selectedLead.business.redes_sociales.instagram : `https://instagram.com/${selectedLead.business.redes_sociales.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300">
                      <Instagram className="h-3 w-3 mr-1" /> Instagram
                    </a>
                  )}
                  {selectedLead.business?.redes_sociales?.facebook && (
                    <a href={selectedLead.business.redes_sociales.facebook.startsWith('http') ? selectedLead.business.redes_sociales.facebook : `https://facebook.com/${selectedLead.business.redes_sociales.facebook}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                      👍 Facebook
                    </a>
                  )}
                </div>

                {/* Email warning - now allows message generation */}
                {!selectedLead.business?.email && (
                  <Alert className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Sin email asociado. Puedes generar un mensaje de contacto para usar en redes sociales o teléfono.
                    </AlertDescription>
                  </Alert>
                )}
                
                {!selectedLead.business?.web && !selectedLead.business?.telefono && !selectedLead.business?.email && (
                  <p className="text-xs text-muted-foreground italic">Sin datos de contacto disponibles</p>
                )}

                {/* Notes section */}
                {selectedLead.notas && (
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-medium text-muted-foreground">Análisis del negocio:</Label>
                    <ScrollArea className="h-32 mt-1 rounded border p-2 bg-muted/30">
                      <p className="text-xs whitespace-pre-wrap">{selectedLead.notas}</p>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* Button for email generation - only if has email */}
              {selectedLead?.business?.email ? (
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
                  {selectedLead?.notas ? 'Generar Nuevo Email' : 'Analizar y Generar Email'}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={analizarYGuardarMensaje}
                  disabled={!selectedLead || generating}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generar Mensaje de Contacto
                </Button>
              )}
            </div>
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
                rows={14}
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
