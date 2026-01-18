import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Loader2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Tag,
  MessageSquare,
  Trash2,
  ExternalLink,
  Building2,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScoreBadge } from '@/components/ui/score-badge';
import { EstadoBadge } from '@/components/ui/estado-badge';
import { GoogleMapsPopup } from '@/components/ui/google-maps-popup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Business, Lead, EstadoLead, RedesSociales } from '@/lib/types';

interface LeadWithBusiness extends Lead {
  business: Business;
}

const ESTADOS: EstadoLead[] = ['nuevo', 'contactado', 'respondido', 'descartado'];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lead, setLead] = useState<LeadWithBusiness | null>(null);
  
  // Editable fields
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [provincia, setProvincia] = useState('');
  const [web, setWeb] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [notas, setNotas] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (user && id) {
      fetchLead();
    }
  }, [user, id]);

  const fetchLead = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, business:businesses(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const typedLead = {
        ...data,
        etiquetas: data.etiquetas || [],
        business: data.business as Business,
      } as LeadWithBusiness;
      
      setLead(typedLead);
      initializeFields(typedLead);
    } catch (error) {
      console.error('Error fetching lead:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar el lead',
      });
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  const initializeFields = (leadData: LeadWithBusiness) => {
    setNombre(leadData.business?.nombre || '');
    setCategoria(leadData.business?.categoria || '');
    setCiudad(leadData.business?.ciudad || '');
    setDireccion(leadData.business?.direccion || '');
    setProvincia(leadData.business?.provincia || '');
    setWeb(leadData.business?.web || '');
    setTelefono(leadData.business?.telefono || '');
    setEmail(leadData.business?.email || '');
    setNotas(leadData.notas || '');
    
    const redes = (leadData.business?.redes_sociales || {}) as { instagram?: string; facebook?: string; twitter?: string; linkedin?: string };
    setInstagram(redes.instagram || '');
    setFacebook(redes.facebook || '');
    setTwitter(redes.twitter || '');
    setLinkedin(redes.linkedin || '');
  };

  const handleSave = async () => {
    if (!lead) return;
    
    setSaving(true);
    try {
      const redes_sociales: RedesSociales = {};
      if (instagram) redes_sociales.instagram = instagram;
      if (facebook) redes_sociales.facebook = facebook;
      if (twitter) redes_sociales.twitter = twitter;
      if (linkedin) redes_sociales.linkedin = linkedin;

      // Update business
      const { error: businessError } = await supabase
        .from('businesses')
        .update({
          nombre,
          categoria,
          ciudad,
          direccion,
          provincia,
          web: web || null,
          telefono: telefono || null,
          email: email || null,
          redes_sociales: Object.keys(redes_sociales).length > 0 ? redes_sociales : null,
        })
        .eq('id', lead.business.id);

      if (businessError) throw businessError;

      // Update lead notes
      const { error: leadError } = await supabase
        .from('leads')
        .update({ notas })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      const updatedBusiness: Business = {
        ...lead.business,
        nombre,
        categoria,
        ciudad,
        direccion,
        provincia,
        web: web || null,
        telefono: telefono || null,
        email: email || null,
        redes_sociales: Object.keys(redes_sociales).length > 0 ? redes_sociales : null,
      };

      setLead({
        ...lead,
        notas,
        business: updatedBusiness,
      });

      setEditing(false);
      toast({ title: 'Lead actualizado correctamente' });
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el lead',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (lead) {
      initializeFields(lead);
    }
    setEditing(false);
  };

  const actualizarEstado = async (nuevoEstado: EstadoLead) => {
    if (!lead) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          estado: nuevoEstado,
          ultimo_contacto: nuevoEstado === 'contactado' ? new Date().toISOString() : undefined,
        })
        .eq('id', lead.id);

      if (error) throw error;

      setLead({
        ...lead,
        estado: nuevoEstado,
        ultimo_contacto: nuevoEstado === 'contactado' ? new Date().toISOString() : lead.ultimo_contacto,
      });

      toast({ title: 'Estado actualizado' });
    } catch (error) {
      console.error('Error updating estado:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado',
      });
    }
  };

  const agregarEtiqueta = async () => {
    if (!lead || !newTag.trim()) return;

    const nuevasEtiquetas = [...lead.etiquetas, newTag.trim()];

    try {
      const { error } = await supabase
        .from('leads')
        .update({ etiquetas: nuevasEtiquetas })
        .eq('id', lead.id);

      if (error) throw error;

      setLead({ ...lead, etiquetas: nuevasEtiquetas });
      setNewTag('');
      toast({ title: 'Etiqueta añadida' });
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo añadir la etiqueta',
      });
    }
  };

  const eliminarEtiqueta = async (etiqueta: string) => {
    if (!lead) return;

    const nuevasEtiquetas = lead.etiquetas.filter((t) => t !== etiqueta);

    try {
      const { error } = await supabase
        .from('leads')
        .update({ etiquetas: nuevasEtiquetas })
        .eq('id', lead.id);

      if (error) throw error;

      setLead({ ...lead, etiquetas: nuevasEtiquetas });
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const eliminarLead = async () => {
    if (!lead) return;

    try {
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      if (error) throw error;

      toast({ title: 'Lead eliminado' });
      navigate('/leads');
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el lead',
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Lead no encontrado</p>
        <Button variant="link" onClick={() => navigate('/leads')}>
          Volver a leads
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{lead.business.nombre}</h1>
            <p className="text-muted-foreground">{lead.business.categoria}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Link to={`/comunicaciones?lead=${lead.id}`}>
                <Button>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Generar Mensaje
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Información del Negocio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Provincia</Label>
                    <Input value={provincia} onChange={(e) => setProvincia(e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Dirección</Label>
                    <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre</p>
                    <p className="font-medium">{lead.business.nombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Categoría</p>
                    <p className="font-medium">{lead.business.categoria}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ciudad</p>
                    <p className="font-medium">{lead.business.ciudad}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Provincia</p>
                    <p className="font-medium">{lead.business.provincia}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Dirección</p>
                    <GoogleMapsPopup direccion={lead.business.direccion} ciudad={lead.business.ciudad} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Datos de Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Web</Label>
                    <Input value={web} onChange={(e) => setWeb(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+34..." />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Web</p>
                    {lead.business.web ? (
                      <a 
                        href={lead.business.web.startsWith('http') ? lead.business.web : `https://${lead.business.web}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        {lead.business.web}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No disponible</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Teléfono</p>
                    {lead.business.telefono ? (
                      <a href={`tel:${lead.business.telefono}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Phone className="h-4 w-4" />
                        {lead.business.telefono}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No disponible</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Email</p>
                    {lead.business.email ? (
                      <a href={`mailto:${lead.business.email}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Mail className="h-4 w-4" />
                        {lead.business.email}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No disponible</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Media Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-5 w-5" />
                Redes Sociales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario o URL" />
                  </div>
                  <div className="space-y-2">
                    <Label>Facebook</Label>
                    <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="URL de Facebook" />
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter/X</Label>
                    <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@usuario o URL" />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn</Label>
                    <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="URL de LinkedIn" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    const redes = (lead.business.redes_sociales || {}) as { instagram?: string; facebook?: string; twitter?: string; linkedin?: string };
                    const hasAnySocial = redes.instagram || redes.facebook || redes.twitter || redes.linkedin;
                    
                    if (!hasAnySocial) {
                      return <p className="col-span-2 text-muted-foreground">No hay redes sociales registradas</p>;
                    }
                    
                    return (
                      <>
                        {redes.instagram && (
                          <a 
                            href={redes.instagram.startsWith('http') ? redes.instagram : `https://instagram.com/${redes.instagram.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Instagram className="h-4 w-4" />
                            {redes.instagram}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {redes.facebook && (
                          <a 
                            href={redes.facebook.startsWith('http') ? redes.facebook : `https://facebook.com/${redes.facebook}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Facebook className="h-4 w-4" />
                            Facebook
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {redes.twitter && (
                          <a 
                            href={redes.twitter.startsWith('http') ? redes.twitter : `https://x.com/${redes.twitter.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Twitter className="h-4 w-4" />
                            {redes.twitter}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {redes.linkedin && (
                          <a 
                            href={redes.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                          >
                            <Linkedin className="h-4 w-4" />
                            LinkedIn
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea 
                  value={notas} 
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Añade notas sobre este lead..."
                  rows={4}
                />
              ) : (
                <p className={lead.notas ? '' : 'text-muted-foreground'}>
                  {lead.notas || 'Sin notas'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={lead.estado} onValueChange={(v) => actualizarEstado(v as EstadoLead)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((estado) => (
                    <SelectItem key={estado} value={estado} className="capitalize">
                      {estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creado</span>
                  <span>{formatDate(lead.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último contacto</span>
                  <span>{formatDate(lead.ultimo_contacto)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Puntuación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Score Potencial</span>
                <ScoreBadge score={lead.business.potencial_score} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Presencia Digital</span>
                <ScoreBadge score={lead.business.presencia_digital_score} />
              </div>
              {lead.business.motivo_scoring && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Motivo de puntuación</p>
                  <p className="text-sm">{lead.business.motivo_scoring}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Etiquetas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {lead.etiquetas.length > 0 ? (
                  lead.etiquetas.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        onClick={() => eliminarEtiqueta(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin etiquetas</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Nueva etiqueta"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregarEtiqueta()}
                />
                <Button size="sm" onClick={agregarEtiqueta} disabled={!newTag.trim()}>
                  Añadir
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Lead
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar lead?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará permanentemente este lead de tu lista.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={eliminarLead}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
