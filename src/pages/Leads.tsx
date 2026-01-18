import { useEffect, useState } from 'react';
import {
  Users,
  MapPin,
  Loader2,
  Mail,
  Trash2,
  Tag,
  FileText,
  Download,
  Edit,
  X,
  Check,
  Globe,
  Phone,
  Instagram,
  Facebook,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScoreBadge } from '@/components/ui/score-badge';
import { EstadoBadge } from '@/components/ui/estado-badge';
import { useToast } from '@/hooks/use-toast';
import type { Business, Lead, EstadoLead, RedesSociales } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';

interface LeadWithBusiness extends Lead {
  business: Business;
}

const ESTADOS: EstadoLead[] = ['nuevo', 'contactado', 'respondido', 'descartado'];

export default function Leads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadWithBusiness[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadWithBusiness[]>([]);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<LeadWithBusiness | null>(null);
  const [editingNotas, setEditingNotas] = useState(false);
  const [notasTemp, setNotasTemp] = useState('');
  const [newTag, setNewTag] = useState('');

  // Get unique categories from leads
  const categorias = [...new Set(leads.map(l => l.business?.categoria).filter(Boolean))];

  const parseRedesSociales = (redes: RedesSociales): { instagram?: string; facebook?: string; twitter?: string; linkedin?: string } => {
    if (!redes) return {};
    return redes as { instagram?: string; facebook?: string; twitter?: string; linkedin?: string };
  };

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  useEffect(() => {
    filterLeads();
  }, [leads, search, filterEstado, filterCategoria, filterScore]);

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
      
      // Sort by business potencial_score descending
      typedLeads.sort((a, b) => (b.business?.potencial_score || 0) - (a.business?.potencial_score || 0));
      
      setLeads(typedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los leads',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.business?.nombre.toLowerCase().includes(searchLower) ||
          l.business?.categoria.toLowerCase().includes(searchLower) ||
          l.etiquetas.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (filterEstado !== 'all') {
      filtered = filtered.filter((l) => l.estado === filterEstado);
    }

    if (filterCategoria !== 'all') {
      filtered = filtered.filter((l) => l.business?.categoria === filterCategoria);
    }

    if (filterScore !== 'all') {
      if (filterScore === 'high') {
        filtered = filtered.filter((l) => (l.business?.potencial_score || 0) >= 70);
      } else if (filterScore === 'medium') {
        filtered = filtered.filter(
          (l) => (l.business?.potencial_score || 0) >= 40 && (l.business?.potencial_score || 0) < 70
        );
      } else if (filterScore === 'low') {
        filtered = filtered.filter((l) => (l.business?.potencial_score || 0) < 40);
      }
    }

    setFilteredLeads(filtered);
  };

  const actualizarEstado = async (leadId: string, nuevoEstado: EstadoLead) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          estado: nuevoEstado,
          ultimo_contacto: nuevoEstado === 'contactado' ? new Date().toISOString() : undefined,
        })
        .eq('id', leadId);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                estado: nuevoEstado,
                ultimo_contacto:
                  nuevoEstado === 'contactado' ? new Date().toISOString() : l.ultimo_contacto,
              }
            : l
        )
      );

      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) =>
          prev
            ? {
                ...prev,
                estado: nuevoEstado,
                ultimo_contacto:
                  nuevoEstado === 'contactado' ? new Date().toISOString() : prev.ultimo_contacto,
              }
            : null
        );
      }

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

  const guardarNotas = async () => {
    if (!selectedLead) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({ notas: notasTemp })
        .eq('id', selectedLead.id);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? { ...l, notas: notasTemp } : l))
      );
      setSelectedLead((prev) => (prev ? { ...prev, notas: notasTemp } : null));
      setEditingNotas(false);
      toast({ title: 'Notas guardadas' });
    } catch (error) {
      console.error('Error saving notas:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron guardar las notas',
      });
    }
  };

  const agregarEtiqueta = async () => {
    if (!selectedLead || !newTag.trim()) return;

    const nuevasEtiquetas = [...selectedLead.etiquetas, newTag.trim()];

    try {
      const { error } = await supabase
        .from('leads')
        .update({ etiquetas: nuevasEtiquetas })
        .eq('id', selectedLead.id);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id ? { ...l, etiquetas: nuevasEtiquetas } : l
        )
      );
      setSelectedLead((prev) =>
        prev ? { ...prev, etiquetas: nuevasEtiquetas } : null
      );
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
    if (!selectedLead) return;

    const nuevasEtiquetas = selectedLead.etiquetas.filter((t) => t !== etiqueta);

    try {
      const { error } = await supabase
        .from('leads')
        .update({ etiquetas: nuevasEtiquetas })
        .eq('id', selectedLead.id);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id ? { ...l, etiquetas: nuevasEtiquetas } : l
        )
      );
      setSelectedLead((prev) =>
        prev ? { ...prev, etiquetas: nuevasEtiquetas } : null
      );
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const eliminarLead = async (leadId: string) => {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setSelectedLead(null);
      toast({ title: 'Lead eliminado' });
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el lead',
      });
    }
  };

  const exportarCSV = () => {
    const headers = ['nombre', 'categoria', 'ciudad', 'web', 'potencial_score', 'estado', 'etiquetas', 'notas'];
    const rows = filteredLeads.map((l) => [
      l.business.nombre,
      l.business.categoria,
      l.business.ciudad,
      l.business.web || '',
      l.business.potencial_score,
      l.estado,
      l.etiquetas.join(';'),
      l.notas || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'CSV exportado' });
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
      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e} className="capitalize">
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorías</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterScore} onValueChange={setFilterScore}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos scores</SelectItem>
              <SelectItem value="high">Alto (≥70)</SelectItem>
              <SelectItem value="medium">Medio (40-69)</SelectItem>
              <SelectItem value="low">Bajo (&lt;40)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportarCSV} disabled={filteredLeads.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

{/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} (ordenados por score)
      </p>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No hay leads</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Guarda negocios como leads desde la sección de Negocios
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLeads.map((lead) => (
            <Card
              key={lead.id}
              className="cursor-pointer shadow-card hover:shadow-card-hover transition-shadow"
              onClick={() => {
                setSelectedLead(lead);
                setNotasTemp(lead.notas || '');
                setEditingNotas(false);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{lead.business?.nombre}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{lead.business?.ciudad}</span>
                    </p>
                  </div>
                  <ScoreBadge score={lead.business?.potencial_score || 0} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <EstadoBadge estado={lead.estado} />
                  <span className="text-xs text-muted-foreground">
                    {lead.business?.categoria}
                  </span>
                </div>

                {/* Contact Info Compact */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {lead.business?.web && (
                    <span className="inline-flex items-center rounded bg-success/10 text-success px-1.5 py-0.5 text-xs">
                      <Globe className="h-3 w-3" />
                    </span>
                  )}
                  {lead.business?.telefono && (
                    <span className="inline-flex items-center rounded bg-info/10 text-info px-1.5 py-0.5 text-xs">
                      <Phone className="h-3 w-3" />
                    </span>
                  )}
                  {lead.business?.email && (
                    <span className="inline-flex items-center rounded bg-info/10 text-info px-1.5 py-0.5 text-xs">
                      <Mail className="h-3 w-3" />
                    </span>
                  )}
                  {(() => {
                    const redes = parseRedesSociales(lead.business?.redes_sociales);
                    return (
                      <>
                        {redes.instagram && (
                          <span className="inline-flex items-center rounded bg-pink-100 text-pink-700 px-1.5 py-0.5 text-xs">
                            <Instagram className="h-3 w-3" />
                          </span>
                        )}
                        {redes.facebook && (
                          <span className="inline-flex items-center rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-xs">
                            <Facebook className="h-3 w-3" />
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>

                {lead.etiquetas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {lead.etiquetas.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {lead.etiquetas.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{lead.etiquetas.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedLead.business?.nombre}
                  <ScoreBadge score={selectedLead.business?.potencial_score || 0} />
                </DialogTitle>
                <DialogDescription>
                  {selectedLead.business?.categoria} • {selectedLead.business?.ciudad}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Estado */}
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={selectedLead.estado}
                    onValueChange={(v) => actualizarEstado(selectedLead.id, v as EstadoLead)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map((e) => (
                        <SelectItem key={e} value={e} className="capitalize">
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Etiquetas */}
                <div className="space-y-2">
                  <Label>Etiquetas</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedLead.etiquetas.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {tag}
                        <button
                          onClick={() => eliminarEtiqueta(tag)}
                          className="ml-1 rounded-full hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nueva etiqueta..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && agregarEtiqueta()}
                    />
                    <Button size="sm" onClick={agregarEtiqueta} disabled={!newTag.trim()}>
                      <Tag className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Notas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Notas</Label>
                    {!editingNotas ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingNotas(true)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingNotas(false);
                            setNotasTemp(selectedLead.notas || '');
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={guardarNotas}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingNotas ? (
                    <Textarea
                      value={notasTemp}
                      onChange={(e) => setNotasTemp(e.target.value)}
                      placeholder="Añade notas sobre este lead..."
                      rows={3}
                    />
                  ) : (
                    <p className="rounded-lg bg-muted p-3 text-sm">
                      {selectedLead.notas || 'Sin notas'}
                    </p>
                  )}
                </div>

                {/* Info adicional - Datos de contacto */}
                <div className="space-y-2">
                  <Label>Datos de Contacto</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedLead.business?.web && (
                      <a
                        href={selectedLead.business.web}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md bg-success/10 text-success px-2 py-1 text-xs hover:bg-success/20"
                      >
                        <Globe className="mr-1 h-3 w-3" />
                        Web
                      </a>
                    )}
                    {selectedLead.business?.telefono && (
                      <a
                        href={`tel:${selectedLead.business.telefono}`}
                        className="inline-flex items-center rounded-md bg-info/10 text-info px-2 py-1 text-xs hover:bg-info/20"
                      >
                        <Phone className="mr-1 h-3 w-3" />
                        {selectedLead.business.telefono}
                      </a>
                    )}
                    {selectedLead.business?.email && (
                      <a
                        href={`mailto:${selectedLead.business.email}`}
                        className="inline-flex items-center rounded-md bg-info/10 text-info px-2 py-1 text-xs hover:bg-info/20"
                      >
                        <Mail className="mr-1 h-3 w-3" />
                        {selectedLead.business.email}
                      </a>
                    )}
                    {(() => {
                      const redes = parseRedesSociales(selectedLead.business?.redes_sociales);
                      return (
                        <>
                          {redes.instagram && (
                            <a
                              href={redes.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-pink-100 text-pink-700 px-2 py-1 text-xs hover:bg-pink-200"
                            >
                              <Instagram className="mr-1 h-3 w-3" />
                              Instagram
                            </a>
                          )}
                          {redes.facebook && (
                            <a
                              href={redes.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-blue-100 text-blue-700 px-2 py-1 text-xs hover:bg-blue-200"
                            >
                              <Facebook className="mr-1 h-3 w-3" />
                              Facebook
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {!selectedLead.business?.web && !selectedLead.business?.telefono && !selectedLead.business?.email && (
                    <p className="text-xs text-muted-foreground italic">Sin datos de contacto disponibles</p>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => eliminarLead(selectedLead.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Link to={`/emails?lead=${selectedLead.id}`}>
                  <Button>
                    <Mail className="mr-2 h-4 w-4" />
                    Generar Email
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
