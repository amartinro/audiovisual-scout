import { useState } from 'react';
import { Search, MapPin, Loader2, Plus, Building2, Globe, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { calcularPotencialScore, calcularPresenciaDigitalScore } from '@/lib/scoring';
import type { Business, TamanoNegocio } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OSMResult {
  place_id: number;
  display_name: string;
  name?: string;
  type: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
  };
  extratags?: {
    website?: string;
    phone?: string;
    'contact:instagram'?: string;
    'contact:facebook'?: string;
  };
}

const CATEGORIAS = [
  'Restaurante',
  'Hotel',
  'Bar',
  'Cafetería',
  'Gimnasio',
  'Clínica',
  'Estética',
  'Bodega',
  'Eventos',
  'Turismo',
  'Comercio',
  'Servicios',
];

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

export default function BuscarNegocios() {
  const { toast } = useToast();
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [results, setResults] = useState<OSMResult[]>([]);
  const [categoria, setCategoria] = useState('');
  const [ciudad, setCiudad] = useState('Salamanca');
  const [query, setQuery] = useState('');

  const buscarNegocios = async () => {
    if (!categoria && !query) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Selecciona una categoría o escribe un término de búsqueda',
      });
      return;
    }

    setSearching(true);
    setResults([]);

    try {
      const searchTerm = query || categoria;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchTerm
      )}+${encodeURIComponent(ciudad)}+Salamanca+España&format=json&addressdetails=1&extratags=1&limit=20`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ProspectAV/1.0',
        },
      });

      if (!response.ok) throw new Error('Error en la búsqueda');

      const data: OSMResult[] = await response.json();
      
      // Filter results in Salamanca province
      const filtered = data.filter(
        (r) =>
          r.address?.state?.toLowerCase().includes('salamanca') ||
          r.address?.city?.toLowerCase().includes('salamanca') ||
          r.display_name.toLowerCase().includes('salamanca')
      );

      setResults(filtered);

      if (filtered.length === 0) {
        toast({
          title: 'Sin resultados',
          description: 'No se encontraron negocios. Prueba con otros términos.',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        variant: 'destructive',
        title: 'Error de búsqueda',
        description: 'No se pudo completar la búsqueda. Inténtalo de nuevo.',
      });
    } finally {
      setSearching(false);
    }
  };

  const guardarNegocio = async (result: OSMResult) => {
    setSaving(String(result.place_id));

    try {
      const nombre = result.name || result.display_name.split(',')[0];
      const direccion = [
        result.address?.road,
        result.address?.house_number,
      ]
        .filter(Boolean)
        .join(' ') || result.display_name.split(',').slice(0, 2).join(', ');
      
      const ciudadNegocio =
        result.address?.city ||
        result.address?.town ||
        result.address?.village ||
        result.address?.municipality ||
        ciudad;

      const tieneWeb = !!result.extratags?.website;
      const redesSociales = {
        instagram: result.extratags?.['contact:instagram'] || null,
        facebook: result.extratags?.['contact:facebook'] || null,
      };
      const tieneRedes = Object.values(redesSociales).some(Boolean);

      // Estimate size based on type
      const tamanoEstimado: TamanoNegocio = result.type === 'hotel' ? 'grande' : 'pequeno';

      const presenciaScore = calcularPresenciaDigitalScore(tieneWeb, false, !tieneRedes);
      const potencialScore = calcularPotencialScore({
        tamanoEstimado,
        tieneWeb,
        webPobre: false,
        redesSocialesAbandonadas: !tieneRedes,
        tipoNegocio: categoria || result.type,
      });

      const { error } = await supabase.from('businesses').insert({
        nombre,
        categoria: categoria || result.type,
        direccion,
        ciudad: ciudadNegocio,
        provincia: 'Salamanca',
        fuente_datos: 'OpenStreetMap',
        web: result.extratags?.website || null,
        redes_sociales: tieneRedes ? redesSociales : null,
        tamano_estimado: tamanoEstimado,
        presencia_digital_score: presenciaScore,
        potencial_score: potencialScore,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            variant: 'destructive',
            title: 'Duplicado',
            description: 'Este negocio ya existe en la base de datos',
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: '¡Guardado!',
          description: `${nombre} añadido con score ${potencialScore}`,
        });
        // Remove from results
        setResults((prev) => prev.filter((r) => r.place_id !== result.place_id));
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el negocio',
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Negocios
          </CardTitle>
          <CardDescription>
            Busca negocios en Salamanca y provincia usando OpenStreetMap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Select value={ciudad} onValueChange={setCiudad}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CIUDADES_SALAMANCA.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Búsqueda libre</Label>
              <Input
                placeholder="Nombre, tipo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarNegocios()}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={buscarNegocios} disabled={searching} className="w-full">
                {searching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Los datos provienen de OpenStreetMap. El scoring se calcula automáticamente 
          basándose en el tamaño estimado, presencia digital y tipo de negocio.
        </AlertDescription>
      </Alert>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Resultados ({results.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => {
              const nombre = result.name || result.display_name.split(',')[0];
              const tieneWeb = !!result.extratags?.website;
              const score = calcularPotencialScore({
                tamanoEstimado: 'pequeno',
                tieneWeb,
                webPobre: false,
                redesSocialesAbandonadas: true,
                tipoNegocio: categoria || result.type,
              });

              return (
                <Card
                  key={result.place_id}
                  className="shadow-card hover:shadow-card-hover transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{nombre}</h3>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">
                            {result.address?.city ||
                              result.address?.town ||
                              result.address?.village ||
                              'Salamanca'}
                          </span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs">
                            <Building2 className="mr-1 h-3 w-3" />
                            {result.type}
                          </span>
                          {tieneWeb && (
                            <span className="inline-flex items-center rounded-md bg-success/10 text-success px-2 py-1 text-xs">
                              <Globe className="mr-1 h-3 w-3" />
                              Web
                            </span>
                          )}
                        </div>
                      </div>
                      <ScoreBadge score={score} />
                    </div>
                    <Button
                      className="mt-4 w-full"
                      size="sm"
                      onClick={() => guardarNegocio(result)}
                      disabled={saving === String(result.place_id)}
                    >
                      {saving === String(result.place_id) ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Guardar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searching && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Busca negocios</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona una categoría y ciudad para empezar a buscar
          </p>
        </div>
      )}
    </div>
  );
}
