import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Loader2,
  Mail,
  Trash2,
  Tag,
  Download,
  Edit,
  X,
  Check,
  Globe,
  Phone,
  Instagram,
  Facebook,
  Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScoreBadge } from '@/components/ui/score-badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link, useSearchParams } from 'react-router-dom';
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle';
import { LeadCard } from '@/components/leads/LeadCard';
import { LeadListItem } from '@/components/leads/LeadListItem';
import { GoogleMapsPopup } from '@/components/ui/google-maps-popup';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { LeadEditDialog } from '@/components/leads/LeadEditDialog';

interface LeadWithBusiness extends Lead {
  business: Business;
}

const ESTADOS: EstadoLead[] = ['nuevo', 'contactado', 'respondido', 'descartado'];

export default function Leads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadWithBusiness[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadWithBusiness[]>([]);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<string>('all');
  const [filterContacto, setFilterContacto] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithBusiness | null>(null);
  const [editingNotas, setEditingNotas] = useState(false);
  const [notasTemp, setNotasTemp] = useState('');
  const [newTag, setNewTag] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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

  // Handle selected lead from URL params
  useEffect(() => {
    const selectedId = searchParams.get('selected');
    if (selectedId && leads.length > 0) {
      const lead = leads.find(l => l.id === selectedId);
      if (lead) {
        setSelectedLead(lead);
        setNotasTemp(lead.notas || '');
      }
    }
  }, [searchParams, leads]);

  useEffect(() => {
    filterLeads();
  }, [leads, search, filterEstado, filterCategoria, filterScore, filterContacto]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterEstado, filterCategoria, filterScore, filterContacto]);

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

    // Filter by contact methods
    if (filterContacto.length > 0) {
      filtered = filtered.filter((l) => {
        const redes = parseRedesSociales(l.business?.redes_sociales);
        return filterContacto.every((tipo) => {
          switch (tipo) {
            case 'email': return !!l.business?.email;
            case 'telefono': return !!l.business?.telefono;
            case 'web': return !!l.business?.web;
            case 'instagram': return !!redes.instagram;
            case 'facebook': return !!redes.facebook;
            default: return true;
          }
        });
      });
    }

    setFilteredLeads(filtered);
  };

  // Paginated leads
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLeads.slice(startIndex, startIndex + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);

  const toggleContactFilter = (tipo: string) => {
    setFilterContacto(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
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
    const headers = ['nombre', 'categoria', 'ciudad', 'direccion', 'web', 'telefono', 'email', 'potencial_score', 'motivo_scoring', 'estado', 'etiquetas', 'notas'];
    const rows = filteredLeads.map((l) => [
      l.business.nombre,
      l.business.categoria,
      l.business.ciudad,
      l.business.direccion,
      l.business.web || '',
      l.business.telefono || '',
      l.business.email || '',
      l.business.potencial_score,
      l.business.motivo_scoring || '',
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

  const handleLeadClick = (lead: LeadWithBusiness) => {
    setSelectedLead(lead);
    setNotasTemp(lead.notas || '');
    setEditingNotas(false);
  };

  const handleLeadUpdated = (updatedLead: LeadWithBusiness) => {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
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
      <div className="space-y-4">
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
          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            <Button variant="outline" onClick={exportarCSV} disabled={filteredLeads.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Contact Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-muted-foreground">Filtrar por contacto:</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lead-filter-email" 
                checked={filterContacto.includes('email')}
                onCheckedChange={() => toggleContactFilter('email')}
              />
              <Label htmlFor="lead-filter-email" className="text-sm cursor-pointer flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lead-filter-telefono" 
                checked={filterContacto.includes('telefono')}
                onCheckedChange={() => toggleContactFilter('telefono')}
              />
              <Label htmlFor="lead-filter-telefono" className="text-sm cursor-pointer flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Teléfono
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lead-filter-web" 
                checked={filterContacto.includes('web')}
                onCheckedChange={() => toggleContactFilter('web')}
              />
              <Label htmlFor="lead-filter-web" className="text-sm cursor-pointer flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> Web
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lead-filter-instagram" 
                checked={filterContacto.includes('instagram')}
                onCheckedChange={() => toggleContactFilter('instagram')}
              />
              <Label htmlFor="lead-filter-instagram" className="text-sm cursor-pointer flex items-center gap-1">
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="lead-filter-facebook" 
                checked={filterContacto.includes('facebook')}
                onCheckedChange={() => toggleContactFilter('facebook')}
              />
              <Label htmlFor="lead-filter-facebook" className="text-sm cursor-pointer flex items-center gap-1">
                <Facebook className="h-3.5 w-3.5" /> Facebook
              </Label>
            </div>
          </div>
        </div>
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
            Busca y guarda leads desde la sección de Buscar
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => handleLeadClick(lead)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedLeads.map((lead) => (
            <LeadListItem key={lead.id} lead={lead} onClick={() => handleLeadClick(lead)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredLeads.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredLeads.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Lead Edit Dialog */}
      <LeadEditDialog
        lead={selectedLead}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleLeadUpdated}
      />

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead && !editDialogOpen} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedLead.business?.nombre}
                  <div className="flex items-center gap-1">
                    <ScoreBadge score={selectedLead.business?.potencial_score || 0} />
                    {selectedLead.business?.motivo_scoring && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground">
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{selectedLead.business.motivo_scoring}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </DialogTitle>
                <DialogDescription>
                  {selectedLead.business?.categoria} • {selectedLead.business?.ciudad}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Dirección con mapa */}
                <div className="space-y-2">
                  <Label>Ubicación</Label>
                  <GoogleMapsPopup 
                    direccion={selectedLead.business?.direccion || ''} 
                    ciudad={selectedLead.business?.ciudad}
                  />
                </div>

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
                      rows={4}
                      className="max-h-40 overflow-y-auto"
                    />
                  ) : (
                    <div className="rounded-lg bg-muted p-3 text-sm max-h-40 overflow-y-auto">
                      <p className="whitespace-pre-wrap">{selectedLead.notas || 'Sin notas'}</p>
                    </div>
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
                <div className="flex gap-2">
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

                  <Link to={`/leads/${selectedLead.id}`}>
                    <Button variant="outline">
                      <Info className="mr-2 h-4 w-4" />
                      Ver Detalles
                    </Button>
                  </Link>
                </div>

                <Link to={`/comunicaciones?lead=${selectedLead.id}`}>
                  <Button>
                    <Mail className="mr-2 h-4 w-4" />
                    Generar Mensaje
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
