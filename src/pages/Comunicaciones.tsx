import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Loader2, FileText, Sparkles, AlertTriangle, Globe, Phone, Instagram, MessageCircle, Send } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';
import type { Lead, Business, UserSettings } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProgressDialog, ProgressStep } from '@/components/ui/progress-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PaginationControls } from '@/components/ui/pagination-controls';

interface LeadWithBusiness extends Lead {
  business: Business;
}

export default function Comunicaciones() {
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
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [contactMethod, setContactMethod] = useState<'email' | 'whatsapp'>('email');
  
  // Pagination for lead selector
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (user) {
      fetchLeads();
      fetchUserSettings();
    }
  }, [user]);

  const fetchUserSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setUserSettings(data as UserSettings);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
    }
  };

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

  // Paginated leads for selector
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return leads.slice(startIndex, startIndex + pageSize);
  }, [leads, currentPage, pageSize]);

  const totalPages = Math.ceil(leads.length / pageSize);

  // Auto-select contact method based on available data
  useEffect(() => {
    if (selectedLead) {
      if (selectedLead.business?.email) {
        setContactMethod('email');
      } else if (selectedLead.business?.telefono) {
        setContactMethod('whatsapp');
      }
    }
  }, [selectedLeadId, selectedLead]);

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

  const generarMensajeConIA = async (business: Business, notas: string | null): Promise<{ asunto: string; cuerpo: string } | null> => {
    try {
      // Siempre usar el prompt de configuración del usuario
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: { 
          business, 
          notas,
          customPrompt: userSettings?.email_prompt || null,
          contactMethod
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating message:', error);
      return null;
    }
  };

  const analizarYGenerarMensaje = async () => {
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

      // Step 3: Generate message using analysis data
      updateStep('generate', { status: 'loading', detail: 'Redactando mensaje personalizado...' });
      
      const messageData = await generarMensajeConIA(business, analysis);

      if (messageData) {
        updateStep('generate', { status: 'complete', detail: 'Mensaje generado' });
        setAsunto(messageData.asunto);
        setCuerpo(messageData.cuerpo);
        
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

  const generarMensaje = async () => {
    if (!selectedLead) return;

    const business = selectedLead.business;

    setGenerating(true);
    setProgressOpen(true);

    setProgressSteps([
      { id: 'generate', label: 'Generando mensaje personalizado', status: 'loading', detail: 'Usando prompt de configuración y datos del análisis...' },
    ]);

    try {
      // Usar las notas del lead (análisis previo) y el prompt de configuración
      const messageData = await generarMensajeConIA(business, selectedLead.notas);

      if (messageData) {
        setProgressSteps([
          { id: 'generate', label: 'Generando mensaje personalizado', status: 'complete', detail: 'Mensaje generado' },
        ]);
        setAsunto(messageData.asunto);
        setCuerpo(messageData.cuerpo);
        toast({ title: '¡Mensaje generado!' });
      } else {
        setProgressSteps([
          { id: 'generate', label: 'Generando mensaje personalizado', status: 'error', detail: 'Error al generar' },
        ]);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el mensaje' });
      }
    } catch (error) {
      setProgressSteps([
        { id: 'generate', label: 'Generando mensaje personalizado', status: 'error', detail: 'Error al generar' },
      ]);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el mensaje' });
    } finally {
      setTimeout(() => {
        setProgressOpen(false);
        setGenerating(false);
      }, 1000);
    }
  };

  const guardarBorrador = async () => {
    if (!selectedLead || !cuerpo || (contactMethod === 'email' && !asunto)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: contactMethod === 'email' ? 'Completa el asunto y el cuerpo del mensaje' : 'Completa el cuerpo del mensaje',
      });
      return;
    }

    try {
      const { error } = await supabase.from('emails').insert({
        lead_id: selectedLead.id,
        asunto: contactMethod === 'whatsapp' ? 'Mensaje WhatsApp' : asunto,
        cuerpo,
        estado: 'borrador',
      });

      if (error) throw error;

      toast({
        title: '¡Borrador guardado!',
        description: 'Mensaje guardado en la base de datos',
      });

      // NO limpiar el formulario después de guardar
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
        title="Generando Mensaje" 
        steps={progressSteps} 
      />

      <Alert>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription>
          Genera mensajes personalizados para tus leads (Email o WhatsApp). El mensaje se genera usando el prompt de configuración y los datos del análisis del negocio.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Selection */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Seleccionar Lead</CardTitle>
            <CardDescription>Elige el lead para generar el mensaje ({leads.length} leads)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar lead..." />
              </SelectTrigger>
              <SelectContent>
                {paginatedLeads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    <span className="flex items-center gap-2">
                      {lead.business?.nombre} - {lead.business?.ciudad}
                      {!lead.business?.email && !lead.business?.telefono && (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Pagination for lead selector */}
            {leads.length > pageSize && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={leads.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            )}

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

                {/* Contact warning */}
                {!selectedLead.business?.email && !selectedLead.business?.telefono && (
                  <Alert className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Sin email ni teléfono. Puedes editar el lead para añadir datos de contacto.
                    </AlertDescription>
                  </Alert>
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

            {/* Contact Method Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Medio de contacto</Label>
              <ToggleGroup 
                type="single" 
                value={contactMethod} 
                onValueChange={(value) => value && setContactMethod(value as 'email' | 'whatsapp')}
                className="justify-start"
              >
                <ToggleGroupItem 
                  value="email" 
                  aria-label="Email"
                  disabled={!selectedLead?.business?.email}
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="whatsapp" 
                  aria-label="WhatsApp"
                  disabled={!selectedLead?.business?.telefono}
                  className="data-[state=on]:bg-success data-[state=on]:text-success-foreground"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </ToggleGroupItem>
              </ToggleGroup>
              {selectedLead && !selectedLead.business?.email && !selectedLead.business?.telefono && (
                <p className="text-xs text-muted-foreground">Este lead no tiene email ni teléfono</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={selectedLead?.notas ? generarMensaje : analizarYGenerarMensaje}
                disabled={!selectedLead || generating || (contactMethod === 'email' && !selectedLead?.business?.email) || (contactMethod === 'whatsapp' && !selectedLead?.business?.telefono)}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {selectedLead?.notas 
                  ? `Generar ${contactMethod === 'whatsapp' ? 'Mensaje WhatsApp' : 'Email'}` 
                  : `Analizar y Generar ${contactMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}`
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Message Editor */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Editor de {contactMethod === 'whatsapp' ? 'Mensaje' : 'Email'}</CardTitle>
            <CardDescription>Revisa y edita el mensaje antes de enviarlo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contactMethod === 'email' && (
              <div className="space-y-2">
                <Label>Asunto</Label>
                <Input
                  placeholder="Asunto del email..."
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Cuerpo</Label>
              <Textarea
                placeholder={contactMethod === 'whatsapp' ? 'Mensaje de WhatsApp...' : 'Contenido del email...'}
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={14}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={guardarBorrador}
                disabled={!cuerpo || (contactMethod === 'email' && !asunto)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Guardar Borrador
              </Button>
              
              {contactMethod === 'whatsapp' && selectedLead?.business?.telefono && (
                <Button
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => {
                    // Limpiar teléfono: quitar espacios, guiones y el + inicial
                    let phone = selectedLead.business.telefono || '';
                    phone = phone.replace(/[\s\-\(\)]/g, ''); // Quitar espacios, guiones, paréntesis
                    // Si empieza con +, quitarlo para wa.me
                    if (phone.startsWith('+')) {
                      phone = phone.substring(1);
                    }
                    // Si es español sin prefijo, añadir 34
                    if (phone.length === 9 && (phone.startsWith('6') || phone.startsWith('7') || phone.startsWith('9'))) {
                      phone = '34' + phone;
                    }
                    const message = encodeURIComponent(cuerpo);
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                  }}
                  disabled={!cuerpo}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar por WhatsApp
                </Button>
              )}
              
              {contactMethod === 'email' && selectedLead?.business?.email && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    const subject = encodeURIComponent(asunto);
                    const body = encodeURIComponent(cuerpo);
                    window.open(`mailto:${selectedLead.business.email}?subject=${subject}&body=${body}`, '_blank');
                  }}
                  disabled={!asunto || !cuerpo}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Abrir en Cliente de Email
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
