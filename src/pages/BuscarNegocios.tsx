import { useState, useEffect } from 'react';
import { Search, MapPin, Loader2, Building2, Globe, AlertCircle, Phone, Mail } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { calcularPotencialScore, calcularPresenciaDigitalScore } from '@/lib/scoring';
import type { TamanoNegocio, UserSettings } from '@/lib/types';
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
    email?: string;
    'contact:phone'?: string;
    'contact:email'?: string;
    'contact:instagram'?: string;
    'contact:facebook'?: string;
    'contact:twitter'?: string;
    'contact:linkedin'?: string;
  };
}

const CATEGORIAS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'bar', label: 'Bar' },
  { value: 'cafe', label: 'Cafetería' },
  { value: 'gym', label: 'Gimnasio' },
  { value: 'clinic', label: 'Clínica' },
  { value: 'beauty', label: 'Estética' },
  { value: 'winery', label: 'Bodega' },
  { value: 'events', label: 'Eventos' },
  { value: 'tourism', label: 'Turismo' },
  { value: 'shop', label: 'Comercio' },
  { value: 'services', label: 'Servicios' },
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [searching, setSearching] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [results, setResults] = useState<OSMResult[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [categoria, setCategoria] = useState('');
  const [ciudad, setCiudad] = useState('Salamanca');
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data) {
        setSettings(data as UserSettings);
        setCiudad(data.default_ciudad);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const buscarNegocios = async () => {
    setSearching(true);
    setResults([]);
    setSavedCount(0);

    try {
      // Build search query - category is now optional
      const searchTerms = [query, categoria, ciudad, 'Salamanca', 'España'].filter(Boolean);
      const searchQuery = searchTerms.join(' ');
      
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json&addressdetails=1&extratags=1&limit=50`;

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
          r.name && // Must have a name
          (r.address?.state?.toLowerCase().includes('salamanca') ||
           r.address?.city?.toLowerCase().includes('salamanca') ||
           r.display_name.toLowerCase().includes('salamanca'))
      );

      if (filtered.length === 0) {
        toast({
          title: 'Sin resultados',
          description: 'No se encontraron negocios. Prueba con otros términos.',
        });
        setSearching(false);
        return;
      }

      // Auto-save if enabled
      const autoSave = settings?.auto_save_leads ?? true;
      
      if (autoSave && user) {
        await guardarTodosNegocios(filtered);
      } else {
        setResults(filtered);
        toast({
          title: `${filtered.length} resultados encontrados`,
          description: 'Revisa los negocios antes de guardarlos',
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

  const guardarTodosNegocios = async (osmResults: OSMResult[]) => {
    if (!user) return;
    setSavingAll(true);
    let saved = 0;
    let duplicates = 0;

    for (const result of osmResults) {
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
      const telefono = result.extratags?.phone || result.extratags?.['contact:phone'] || null;
      const email = result.extratags?.email || result.extratags?.['contact:email'] || null;
      
      const redesSociales = {
        instagram: result.extratags?.['contact:instagram'] || null,
        facebook: result.extratags?.['contact:facebook'] || null,
        twitter: result.extratags?.['contact:twitter'] || null,
        linkedin: result.extratags?.['contact:linkedin'] || null,
      };
      const tieneRedes = Object.values(redesSociales).some(Boolean);

      // Estimate size based on type
      const tamanoEstimado: TamanoNegocio = result.type === 'hotel' ? 'grande' : 'pequeno';
      const categoriaFinal = categoria || result.type || 'Comercio';

      const presenciaScore = calcularPresenciaDigitalScore(tieneWeb, false, !tieneRedes);
      const potencialScore = calcularPotencialScore({
        tamanoEstimado,
        tieneWeb,
        webPobre: false,
        redesSocialesAbandonadas: !tieneRedes,
        tipoNegocio: categoriaFinal,
      });

      try {
        // Check if business already exists by name and city
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .eq('nombre', nombre)
          .eq('ciudad', ciudadNegocio)
          .maybeSingle();

        let businessId: string;

        if (existing) {
          businessId = existing.id;
          duplicates++;
        } else {
          // Insert business
          const { data: newBusiness, error: businessError } = await supabase
            .from('businesses')
            .insert({
              nombre,
              categoria: categoriaFinal,
              direccion,
              ciudad: ciudadNegocio,
              provincia: 'Salamanca',
              fuente_datos: 'OpenStreetMap',
              web: result.extratags?.website || null,
              telefono,
              email,
              redes_sociales: tieneRedes ? redesSociales : null,
              tamano_estimado: tamanoEstimado,
              presencia_digital_score: presenciaScore,
              potencial_score: potencialScore,
            })
            .select('id')
            .single();

          if (businessError) {
            console.error('Error inserting business:', businessError);
            continue;
          }
          businessId = newBusiness.id;
          saved++;
        }

        // Check if lead already exists
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('business_id', businessId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existingLead) {
          // Create lead
          await supabase.from('leads').insert({
            business_id: businessId,
            user_id: user.id,
            estado: 'nuevo',
            etiquetas: [],
          });
        }
      } catch (error) {
        console.error('Error saving:', error);
      }
    }

    setSavedCount(saved);
    setSavingAll(false);

    toast({
      title: '¡Búsqueda completada!',
      description: `${saved} nuevos negocios guardados, ${duplicates} duplicados ignorados`,
    });
  };

  const guardarResultadosManual = async () => {
    if (results.length === 0) return;
    await guardarTodosNegocios(results);
    setResults([]);
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
            Busca negocios en Salamanca y provincia usando OpenStreetMap. 
            Los resultados se guardan automáticamente como negocios y leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Categoría (opcional)</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
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
              <Button onClick={buscarNegocios} disabled={searching || savingAll} className="w-full">
                {searching || savingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {savingAll ? 'Guardando...' : 'Buscar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Los datos provienen de OpenStreetMap. El scoring se calcula automáticamente.
          {settings?.auto_save_leads !== false && ' Los resultados se guardan automáticamente como negocios y leads.'}
        </AlertDescription>
      </Alert>

      {/* Results (only shown if auto-save is disabled) */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Resultados ({results.length})
            </h2>
            <Button onClick={guardarResultadosManual} disabled={savingAll}>
              {savingAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-2 h-4 w-4" />
              )}
              Guardar Todos
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => {
              const nombre = result.name || result.display_name.split(',')[0];
              const tieneWeb = !!result.extratags?.website;
              const telefono = result.extratags?.phone || result.extratags?.['contact:phone'];
              const email = result.extratags?.email || result.extratags?.['contact:email'];
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
                          {telefono && (
                            <span className="inline-flex items-center rounded-md bg-info/10 text-info px-2 py-1 text-xs">
                              <Phone className="mr-1 h-3 w-3" />
                              Tel
                            </span>
                          )}
                          {email && (
                            <span className="inline-flex items-center rounded-md bg-info/10 text-info px-2 py-1 text-xs">
                              <Mail className="mr-1 h-3 w-3" />
                              Email
                            </span>
                          )}
                        </div>
                      </div>
                      <ScoreBadge score={score} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved Count */}
      {savedCount > 0 && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-success" />
          </div>
          <h3 className="mt-4 text-lg font-medium">¡{savedCount} negocios guardados!</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ve a Negocios o Leads para verlos ordenados por scoring
          </p>
        </div>
      )}

      {/* Empty State */}
      {!searching && !savingAll && results.length === 0 && savedCount === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Busca negocios</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Escribe un término de búsqueda o selecciona una ciudad para empezar
          </p>
        </div>
      )}
    </div>
  );
}
