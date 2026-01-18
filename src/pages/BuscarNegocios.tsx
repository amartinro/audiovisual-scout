import { useState, useEffect } from 'react';
import { Search, MapPin, Loader2, Building2, Globe, AlertCircle, Phone, Mail, RefreshCw } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { enrichContact, countContactMethods, type ContactInfo } from '@/lib/api/firecrawl';

interface OverpassElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    amenity?: string;
    shop?: string;
    tourism?: string;
    leisure?: string;
    office?: string;
    craft?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    'addr:city'?: string;
    website?: string;
    url?: string;
    phone?: string;
    'phone:mobile'?: string;
    mobile?: string;
    email?: string;
    'contact:phone'?: string;
    'contact:mobile'?: string;
    'contact:email'?: string;
    'contact:website'?: string;
    'contact:instagram'?: string;
    'contact:facebook'?: string;
    'contact:twitter'?: string;
    'contact:linkedin'?: string;
    'contact:youtube'?: string;
    'contact:tiktok'?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
    opening_hours?: string;
    cuisine?: string;
    brand?: string;
    description?: string;
    operator?: string;
  };
}

interface BusinessResult {
  id: number;
  nombre: string;
  categoria: string;
  tipo: string;
  direccion: string;
  ciudad: string;
  lat: number;
  lon: number;
  web: string | null;
  telefono: string | null;
  email: string | null;
  redesSociales: {
    instagram?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
  } | null;
}

// Categorías con sus queries de Overpass
const CATEGORIAS = [
  { value: 'all', label: 'Todas las categorías', query: '' },
  { value: 'restaurant', label: 'Restaurante', query: '["amenity"="restaurant"]' },
  { value: 'hotel', label: 'Hotel', query: '["tourism"="hotel"]' },
  { value: 'bar', label: 'Bar', query: '["amenity"="bar"]' },
  { value: 'cafe', label: 'Cafetería', query: '["amenity"="cafe"]' },
  { value: 'gym', label: 'Gimnasio', query: '["leisure"="fitness_centre"]' },
  { value: 'clinic', label: 'Clínica', query: '["amenity"~"clinic|doctors|dentist|hospital"]' },
  { value: 'beauty', label: 'Estética', query: '["shop"~"beauty|hairdresser|cosmetics"]' },
  { value: 'winery', label: 'Bodega', query: '["craft"="winery"]' },
  { value: 'events', label: 'Eventos', query: '["amenity"~"events_venue|conference_centre"]' },
  { value: 'tourism', label: 'Turismo', query: '["tourism"~"attraction|museum|gallery|hotel|guest_house"]' },
  { value: 'shop', label: 'Comercio', query: '["shop"]' },
  { value: 'pub', label: 'Pub', query: '["amenity"="pub"]' },
  { value: 'bakery', label: 'Panadería', query: '["shop"="bakery"]' },
  { value: 'pharmacy', label: 'Farmacia', query: '["amenity"="pharmacy"]' },
];

// Bounding boxes aproximados para ciudades de Salamanca
const CIUDADES_BBOX: Record<string, { south: number; west: number; north: number; east: number }> = {
  'Salamanca': { south: 40.93, west: -5.72, north: 41.00, east: -5.62 },
  'Béjar': { south: 40.36, west: -5.80, north: 40.40, east: -5.74 },
  'Ciudad Rodrigo': { south: 40.58, west: -6.56, north: 40.62, east: -6.50 },
  'Santa Marta de Tormes': { south: 40.93, west: -5.65, north: 40.96, east: -5.60 },
  'Villares de la Reina': { south: 40.98, west: -5.68, north: 41.01, east: -5.63 },
  'Carbajosa de la Sagrada': { south: 40.92, west: -5.70, north: 40.95, east: -5.65 },
  'Peñaranda de Bracamonte': { south: 40.88, west: -5.23, north: 40.92, east: -5.18 },
  'Alba de Tormes': { south: 40.80, west: -5.53, north: 40.83, east: -5.48 },
  'Guijuelo': { south: 40.54, west: -5.68, north: 40.57, east: -5.64 },
  'Villamayor': { south: 40.98, west: -5.62, north: 41.01, east: -5.58 },
};

const CIUDADES_SALAMANCA = Object.keys(CIUDADES_BBOX);

export default function BuscarNegocios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searching, setSearching] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [enrichingContacts, setEnrichingContacts] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [enrichedCount, setEnrichedCount] = useState(0);
  const [categoria, setCategoria] = useState('all');
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
      const bbox = CIUDADES_BBOX[ciudad];
      if (!bbox) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Ciudad no soportada',
        });
        setSearching(false);
        return;
      }

      // Build Overpass query
      const categoriaObj = CATEGORIAS.find(c => c.value === categoria);
      let categoryFilter = categoriaObj?.query || '';
      
      // If searching all categories, search for common business types
      if (categoria === 'all') {
        categoryFilter = '["name"]["amenity"]';
      }

      // Build the Overpass QL query
      const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
      
      let overpassQuery: string;
      
      if (query.trim()) {
        // If user entered a search term, search by name
        overpassQuery = `
          [out:json][timeout:30];
          (
            node["name"~"${query}",i]${categoryFilter !== '["name"]["amenity"]' ? categoryFilter : ''}(${bboxStr});
            way["name"~"${query}",i]${categoryFilter !== '["name"]["amenity"]' ? categoryFilter : ''}(${bboxStr});
          );
          out center tags;
        `;
      } else if (categoria !== 'all') {
        // Search by category only
        overpassQuery = `
          [out:json][timeout:30];
          (
            node${categoryFilter}["name"](${bboxStr});
            way${categoryFilter}["name"](${bboxStr});
          );
          out center tags;
        `;
      } else {
        // Search all businesses with names (restaurants, bars, cafes, shops, etc.)
        overpassQuery = `
          [out:json][timeout:30];
          (
            node["amenity"~"restaurant|bar|cafe|pub|fast_food"]["name"](${bboxStr});
            node["shop"]["name"](${bboxStr});
            node["tourism"~"hotel|guest_house|hostel"]["name"](${bboxStr});
            node["leisure"="fitness_centre"]["name"](${bboxStr});
            way["amenity"~"restaurant|bar|cafe|pub|fast_food"]["name"](${bboxStr});
            way["shop"]["name"](${bboxStr});
            way["tourism"~"hotel|guest_house|hostel"]["name"](${bboxStr});
          );
          out center tags;
        `;
      }

      console.log('Overpass query:', overpassQuery);

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      const elements: OverpassElement[] = data.elements || [];

      console.log('Found elements:', elements.length);

      // Transform to our format
      const businesses: BusinessResult[] = elements
        .filter(el => el.tags?.name) // Must have a name
        .map(el => {
          const tags = el.tags!;
          const lat = el.lat || el.center?.lat || 0;
          const lon = el.lon || el.center?.lon || 0;
          
          // Determine category
          const tipo = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.office || tags.craft || 'negocio';
          
          // Build address
          const direccion = [tags['addr:street'], tags['addr:housenumber']]
            .filter(Boolean)
            .join(' ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

          // Contact info - check multiple possible fields
          const web = tags.website || tags['contact:website'] || tags.url || null;
          const telefono = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags.mobile || tags['contact:mobile'] || null;
          const email = tags.email || tags['contact:email'] || null;

          // Social media - check both contact: prefix and direct tags
          const redesSociales = {
            instagram: tags['contact:instagram'] || tags.instagram || null,
            facebook: tags['contact:facebook'] || tags.facebook || null,
            twitter: tags['contact:twitter'] || tags.twitter || null,
            linkedin: tags['contact:linkedin'] || tags.linkedin || null,
            youtube: tags['contact:youtube'] || tags.youtube || null,
            tiktok: tags['contact:tiktok'] || tags.tiktok || null,
          };
          const tieneRedes = Object.values(redesSociales).some(Boolean);

          return {
            id: el.id,
            nombre: tags.name!,
            categoria: translateCategory(tipo),
            tipo,
            direccion,
            ciudad: tags['addr:city'] || ciudad,
            lat,
            lon,
            web,
            telefono,
            email,
            redesSociales: tieneRedes ? redesSociales : null,
          };
        });

      if (businesses.length === 0) {
        toast({
          title: 'Sin resultados',
          description: 'No se encontraron negocios. Prueba con otra categoría o ciudad.',
        });
        setSearching(false);
        return;
      }

      // Auto-save if enabled
      const autoSave = settings?.auto_save_leads ?? true;
      
      if (autoSave && user) {
        await guardarTodosNegocios(businesses);
      } else {
        setResults(businesses);
        toast({
          title: `${businesses.length} negocios encontrados`,
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

  const translateCategory = (tipo: string): string => {
    const translations: Record<string, string> = {
      restaurant: 'Restaurante',
      bar: 'Bar',
      cafe: 'Cafetería',
      pub: 'Pub',
      fast_food: 'Comida Rápida',
      hotel: 'Hotel',
      guest_house: 'Casa Rural',
      hostel: 'Hostal',
      shop: 'Comercio',
      supermarket: 'Supermercado',
      bakery: 'Panadería',
      butcher: 'Carnicería',
      clothes: 'Ropa',
      hairdresser: 'Peluquería',
      beauty: 'Estética',
      fitness_centre: 'Gimnasio',
      clinic: 'Clínica',
      doctors: 'Médico',
      dentist: 'Dentista',
      pharmacy: 'Farmacia',
      bank: 'Banco',
      winery: 'Bodega',
    };
    return translations[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const guardarTodosNegocios = async (businessResults: BusinessResult[]) => {
    if (!user) return;
    setSavingAll(true);
    setEnrichingContacts(true);
    setEnrichProgress(0);
    setEnrichedCount(0);
    let saved = 0;
    let duplicates = 0;
    let enriched = 0;

    const total = businessResults.length;

    for (let i = 0; i < businessResults.length; i++) {
      const biz = businessResults[i];
      
      // Update progress
      setEnrichProgress(Math.round(((i + 1) / total) * 100));

      // Build initial contact info
      let contactInfo: ContactInfo = {
        web: biz.web,
        telefono: biz.telefono,
        email: biz.email,
        redesSociales: biz.redesSociales,
      };

      // Check if we need to enrich contact info
      const initialContactCount = countContactMethods(contactInfo);
      
      if (initialContactCount < 2) {
        console.log(`${biz.nombre}: Only ${initialContactCount} contact methods, enriching...`);
        
        try {
          const enrichResult = await enrichContact(biz.nombre, biz.ciudad, contactInfo);
          
          if (enrichResult.success && enrichResult.enriched) {
            contactInfo = enrichResult.contact;
            enriched++;
            console.log(`${biz.nombre}: Enriched to ${enrichResult.contactCount} contact methods`);
          }
        } catch (error) {
          console.error(`Error enriching ${biz.nombre}:`, error);
        }
      }

      // Recalculate contact counts after enrichment
      const tieneWeb = !!contactInfo.web;
      const tieneTelefono = !!contactInfo.telefono;
      const tieneEmail = !!contactInfo.email;
      const tieneRedesSociales = !!(contactInfo.redesSociales && 
        Object.values(contactInfo.redesSociales).some(Boolean));

      // Estimate size (hotels tend to be larger)
      const tamanoEstimado: TamanoNegocio = 
        biz.tipo === 'hotel' ? 'grande' : 
        biz.tipo === 'supermarket' ? 'mediano' : 'pequeno';

      const presenciaScore = calcularPresenciaDigitalScore(tieneWeb, false, !tieneRedesSociales);
      const potencialScore = calcularPotencialScore({
        tamanoEstimado,
        tieneWeb,
        webPobre: false,
        redesSocialesAbandonadas: !tieneRedesSociales,
        tipoNegocio: biz.categoria,
        tieneTelefono,
        tieneEmail,
        tieneRedesSociales,
      });

      try {
        // Check if business already exists by name and city
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .eq('nombre', biz.nombre)
          .eq('ciudad', biz.ciudad)
          .maybeSingle();

        let businessId: string;

        if (existing) {
          businessId = existing.id;
          duplicates++;
        } else {
          // Insert business with enriched contact info
          const { data: newBusiness, error: businessError } = await supabase
            .from('businesses')
            .insert({
              nombre: biz.nombre,
              categoria: biz.categoria,
              direccion: biz.direccion,
              ciudad: biz.ciudad,
              provincia: 'Salamanca',
              fuente_datos: 'OpenStreetMap',
              web: contactInfo.web,
              telefono: contactInfo.telefono,
              email: contactInfo.email,
              redes_sociales: contactInfo.redesSociales,
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

    setEnrichedCount(enriched);
    setSavedCount(saved);
    setSavingAll(false);
    setEnrichingContacts(false);

    toast({
      title: '¡Búsqueda completada!',
      description: `${saved} nuevos negocios guardados, ${enriched} enriquecidos con contactos, ${duplicates} duplicados ignorados`,
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
            Busca negocios reales en Salamanca usando datos de OpenStreetMap.
            Los resultados se guardan automáticamente como negocios y leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
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
              <Label>Buscar por nombre</Label>
              <Input
                placeholder="Nombre del negocio..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarNegocios()}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={buscarNegocios} disabled={searching || savingAll || enrichingContacts} className="w-full">
                {searching || savingAll || enrichingContacts ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {enrichingContacts ? 'Enriqueciendo...' : savingAll ? 'Guardando...' : 'Buscar'}
              </Button>
            </div>
          </div>

          {/* Progress bar for enrichment */}
          {enrichingContacts && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Buscando información de contacto adicional...</span>
              </div>
              <Progress value={enrichProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {enrichProgress}% completado - Buscando web, teléfono, email y redes sociales
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Búsqueda inteligente:</strong> Los datos provienen de OpenStreetMap y se enriquecen 
          automáticamente buscando información de contacto adicional (web, teléfono, email, redes sociales).
          {settings?.auto_save_leads !== false && ' Los resultados se guardan automáticamente como negocios y leads.'}
          <br />
          <span className="text-xs">
            ⚠️ Los negocios con menos de 2 métodos de contacto reciben una penalización en el score.
          </span>
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
            {results.map((biz) => {
              const tieneWeb = !!biz.web;
              const score = calcularPotencialScore({
                tamanoEstimado: 'pequeno',
                tieneWeb,
                webPobre: false,
                redesSocialesAbandonadas: !biz.redesSociales,
                tipoNegocio: biz.categoria,
              });

              return (
                <Card
                  key={biz.id}
                  className="shadow-card hover:shadow-card-hover transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{biz.nombre}</h3>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{biz.ciudad}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs">
                            <Building2 className="mr-1 h-3 w-3" />
                            {biz.categoria}
                          </span>
                          {tieneWeb && (
                            <span className="inline-flex items-center rounded-md bg-success/10 text-success px-2 py-1 text-xs">
                              <Globe className="mr-1 h-3 w-3" />
                              Web
                            </span>
                          )}
                          {biz.telefono && (
                            <span className="inline-flex items-center rounded-md bg-info/10 text-info px-2 py-1 text-xs">
                              <Phone className="mr-1 h-3 w-3" />
                              Tel
                            </span>
                          )}
                          {biz.email && (
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
          {enrichedCount > 0 && (
            <p className="mt-1 text-sm text-info flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              {enrichedCount} negocios enriquecidos con contactos adicionales
            </p>
          )}
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
            Selecciona una categoría y ciudad para encontrar negocios reales
          </p>
        </div>
      )}
    </div>
  );
}
