import { useEffect, useState } from 'react';
import { Building2, Globe, MapPin, Loader2, UserPlus, Trash2, Phone, Mail, Instagram, Facebook } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScoreBadge } from '@/components/ui/score-badge';
import { useToast } from '@/hooks/use-toast';
import type { Business, TamanoNegocio, RedesSociales } from '@/lib/types';
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

export default function Negocios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState('');
  const [filterTamano, setFilterTamano] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<string>('all');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [savingLead, setSavingLead] = useState<string | null>(null);

  // Get unique categories from businesses
  const categorias = [...new Set(businesses.map(b => b.categoria).filter(Boolean))];

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    filterBusinesses();
  }, [businesses, search, filterTamano, filterScore, filterCategoria]);

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('potencial_score', { ascending: false });

      if (error) throw error;
      setBusinesses((data || []) as Business[]);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los negocios',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterBusinesses = () => {
    let filtered = [...businesses];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.nombre.toLowerCase().includes(searchLower) ||
          b.categoria.toLowerCase().includes(searchLower) ||
          b.ciudad.toLowerCase().includes(searchLower)
      );
    }

    if (filterTamano !== 'all') {
      filtered = filtered.filter((b) => b.tamano_estimado === filterTamano);
    }

    if (filterCategoria !== 'all') {
      filtered = filtered.filter((b) => b.categoria === filterCategoria);
    }

    if (filterScore !== 'all') {
      if (filterScore === 'high') {
        filtered = filtered.filter((b) => b.potencial_score >= 70);
      } else if (filterScore === 'medium') {
        filtered = filtered.filter(
          (b) => b.potencial_score >= 40 && b.potencial_score < 70
        );
      } else if (filterScore === 'low') {
        filtered = filtered.filter((b) => b.potencial_score < 40);
      }
    }

    // Already sorted by score from the database query
    setFilteredBusinesses(filtered);
  };

  const crearLead = async (business: Business) => {
    if (!user) return;
    setSavingLead(business.id);

    try {
      // Check if lead already exists
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('business_id', business.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Lead existente',
          description: 'Este negocio ya está guardado como lead',
        });
        return;
      }

      const { error } = await supabase.from('leads').insert({
        business_id: business.id,
        user_id: user.id,
        estado: 'nuevo',
        etiquetas: [],
      });

      if (error) throw error;

      toast({
        title: '¡Lead creado!',
        description: `${business.nombre} añadido a tus leads`,
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear el lead',
      });
    } finally {
      setSavingLead(null);
    }
  };

  const eliminarNegocio = async (id: string) => {
    try {
      const { error } = await supabase.from('businesses').delete().eq('id', id);
      if (error) throw error;

      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      toast({
        title: 'Eliminado',
        description: 'Negocio eliminado correctamente',
      });
    } catch (error) {
      console.error('Error deleting business:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el negocio',
      });
    }
  };

  const parseRedesSociales = (redes: RedesSociales): { instagram?: string; facebook?: string; twitter?: string; linkedin?: string } => {
    if (!redes) return {};
    return redes as { instagram?: string; facebook?: string; twitter?: string; linkedin?: string };
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
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
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
        <Select value={filterTamano} onValueChange={setFilterTamano}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tamaño" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tamaños</SelectItem>
            <SelectItem value="pequeno">Pequeño</SelectItem>
            <SelectItem value="mediano">Mediano</SelectItem>
            <SelectItem value="grande">Grande</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterScore} onValueChange={setFilterScore}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Potencial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos scores</SelectItem>
            <SelectItem value="high">Alto (≥70)</SelectItem>
            <SelectItem value="medium">Medio (40-69)</SelectItem>
            <SelectItem value="low">Bajo (&lt;40)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredBusinesses.length} negocio{filteredBusinesses.length !== 1 ? 's' : ''} (ordenados por score)
      </p>

      {/* Business List */}
      {filteredBusinesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No hay negocios</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Usa la búsqueda para importar negocios de OpenStreetMap
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((business) => {
            const redes = parseRedesSociales(business.redes_sociales);
            
            return (
              <Card
                key={business.id}
                className="shadow-card hover:shadow-card-hover transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{business.nombre}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{business.ciudad}</span>
                      </p>
                    </div>
                    <ScoreBadge score={business.potencial_score} showLabel />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs">
                      <Building2 className="mr-1 h-3 w-3" />
                      {business.categoria}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs capitalize">
                      {business.tamano_estimado}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {business.web && (
                      <a
                        href={business.web}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md bg-success/10 text-success px-2 py-1 text-xs hover:bg-success/20"
                      >
                        <Globe className="mr-1 h-3 w-3" />
                        Web
                      </a>
                    )}
                    {business.telefono && (
                      <a
                        href={`tel:${business.telefono}`}
                        className="inline-flex items-center rounded-md bg-info/10 text-info px-2 py-1 text-xs hover:bg-info/20"
                      >
                        <Phone className="mr-1 h-3 w-3" />
                        {business.telefono}
                      </a>
                    )}
                    {business.email && (
                      <a
                        href={`mailto:${business.email}`}
                        className="inline-flex items-center rounded-md bg-info/10 text-info px-2 py-1 text-xs hover:bg-info/20"
                      >
                        <Mail className="mr-1 h-3 w-3" />
                        Email
                      </a>
                    )}
                    {redes.instagram && (
                      <a
                        href={redes.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md bg-pink-100 text-pink-700 px-2 py-1 text-xs hover:bg-pink-200"
                      >
                        <Instagram className="mr-1 h-3 w-3" />
                        IG
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
                        FB
                      </a>
                    )}
                  </div>

                  <p className="mt-2 truncate text-sm text-muted-foreground">
                    {business.direccion}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => crearLead(business)}
                      disabled={savingLead === business.id}
                    >
                      {savingLead === business.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      Crear Lead
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar negocio?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará el negocio y
                            todos sus leads asociados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => eliminarNegocio(business.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
