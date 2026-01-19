import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcularPotencialScoreConMotivo, calcularPresenciaDigitalScore } from '@/lib/scoring';
import { enrichContact, countContactMethods, type ContactInfo } from '@/lib/api/firecrawl';
import type { TamanoNegocio } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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

export interface SearchState {
  isSearching: boolean;
  isProcessing: boolean;
  isStopped: boolean;
  searchQuery: string;
  searchCategoria: string;
  searchCiudad: string;
  totalFound: number;
  processedCount: number;
  savedCount: number;
  enrichedCount: number;
  duplicatesCount: number;
  currentBusiness: string;
  progress: number;
  startTime: Date | null;
  error: string | null;
}

interface SearchContextType {
  state: SearchState;
  startSearch: (params: {
    categoria: string;
    ciudad: string;
    query: string;
    userId: string;
    autoSave: boolean;
  }) => Promise<void>;
  stopSearch: () => void;
  resetSearch: () => void;
}

const initialState: SearchState = {
  isSearching: false,
  isProcessing: false,
  isStopped: false,
  searchQuery: '',
  searchCategoria: '',
  searchCiudad: '',
  totalFound: 0,
  processedCount: 0,
  savedCount: 0,
  enrichedCount: 0,
  duplicatesCount: 0,
  currentBusiness: '',
  progress: 0,
  startTime: null,
  error: null,
};

const SearchContext = createContext<SearchContextType | null>(null);

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

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [state, setState] = useState<SearchState>(initialState);
  const stopRef = useRef(false);
  const isRunningRef = useRef(false);

  const updateState = useCallback((updates: Partial<SearchState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const stopSearch = useCallback(() => {
    stopRef.current = true;
    updateState({ isStopped: true });
  }, [updateState]);

  const resetSearch = useCallback(() => {
    stopRef.current = false;
    isRunningRef.current = false;
    setState(initialState);
  }, []);

  const processBusinesses = async (
    businesses: BusinessResult[],
    userId: string,
    autoSave: boolean
  ) => {
    if (!autoSave) {
      updateState({ 
        isSearching: false, 
        isProcessing: false,
        totalFound: businesses.length 
      });
      return;
    }

    updateState({ isProcessing: true });

    let saved = 0;
    let duplicates = 0;
    let enriched = 0;
    const total = businesses.length;

    for (let i = 0; i < businesses.length; i++) {
      if (stopRef.current) {
        toast({
          title: 'Búsqueda detenida',
          description: `Procesados ${i} de ${total} leads`,
        });
        break;
      }

      const biz = businesses[i];
      const progress = Math.round(((i + 1) / total) * 100);
      
      updateState({
        processedCount: i + 1,
        progress,
        currentBusiness: biz.nombre,
      });

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
        try {
          const enrichResult = await enrichContact(biz.nombre, biz.ciudad, contactInfo);
          
          if (enrichResult.success && enrichResult.enriched) {
            contactInfo = enrichResult.contact;
            enriched++;
            updateState({ enrichedCount: enriched });
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

      // Estimate size
      const tamanoEstimado: TamanoNegocio = 
        biz.tipo === 'hotel' ? 'grande' : 
        biz.tipo === 'supermarket' ? 'mediano' : 'pequeno';

      const presenciaScore = calcularPresenciaDigitalScore(tieneWeb, false, !tieneRedesSociales);
      const scoringResult = calcularPotencialScoreConMotivo({
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
          updateState({ duplicatesCount: duplicates });
        } else {
          // Insert business with enriched contact info and user ownership
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
              potencial_score: scoringResult.score,
              motivo_scoring: scoringResult.motivo,
              user_id: userId,
            })
            .select('id')
            .single();

          if (businessError) {
            console.error('Error inserting business:', businessError);
            continue;
          }
          businessId = newBusiness.id;
          saved++;
          updateState({ savedCount: saved });
        }

        // Check if lead already exists
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('business_id', businessId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingLead) {
          // Create lead with enrichment status
          const estadoEnriquecimiento = enriched > 0 ? 'enriquecido' : 'guardado';
          await supabase.from('leads').insert({
            business_id: businessId,
            user_id: userId,
            estado: 'nuevo',
            estado_enriquecimiento: estadoEnriquecimiento,
            etiquetas: [],
          });
        }
      } catch (error) {
        console.error('Error saving:', error);
      }
    }

    updateState({ 
      isProcessing: false,
      isSearching: false,
    });

    toast({
      title: '¡Búsqueda completada!',
      description: `${saved} nuevos leads guardados, ${enriched} enriquecidos, ${duplicates} duplicados`,
    });
  };

  const startSearch = useCallback(async (params: {
    categoria: string;
    ciudad: string;
    query: string;
    userId: string;
    autoSave: boolean;
  }) => {
    // Prevent multiple concurrent searches
    if (isRunningRef.current) {
      toast({
        variant: 'destructive',
        title: 'Búsqueda en curso',
        description: 'Ya hay una búsqueda en proceso. Detén la actual para iniciar una nueva.',
      });
      return;
    }

    isRunningRef.current = true;
    stopRef.current = false;

    updateState({
      isSearching: true,
      isProcessing: false,
      isStopped: false,
      searchQuery: params.query,
      searchCategoria: params.categoria,
      searchCiudad: params.ciudad,
      totalFound: 0,
      processedCount: 0,
      savedCount: 0,
      enrichedCount: 0,
      duplicatesCount: 0,
      currentBusiness: '',
      progress: 0,
      startTime: new Date(),
      error: null,
    });

    try {
      const bbox = CIUDADES_BBOX[params.ciudad];
      if (!bbox) {
        updateState({ 
          isSearching: false, 
          error: 'Ciudad no soportada' 
        });
        isRunningRef.current = false;
        return;
      }

      const categoriaObj = CATEGORIAS.find(c => c.value === params.categoria);
      let categoryFilter = categoriaObj?.query || '';
      
      if (params.categoria === 'all') {
        categoryFilter = '["name"]["amenity"]';
      }

      const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
      
      let overpassQuery: string;
      
      // Escape regex special characters to prevent injection attacks
      const escapeRegex = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      
      // Validate input contains only safe characters for Overpass QL
      const validateOverpassInput = (input: string): boolean => {
        // Allow alphanumeric, spaces, hyphens, apostrophes, and common Spanish/accented characters
        const safePattern = /^[a-zA-Z0-9\s\-'ñÑáéíóúüÁÉÍÓÚÜ]+$/i;
        return safePattern.test(input);
      };
      
      if (params.query.trim()) {
        // Validate and sanitize the query
        const sanitizedQuery = params.query.trim();
        if (sanitizedQuery.length > 100) {
          updateState({ 
            isSearching: false, 
            error: 'La búsqueda es demasiado larga (máximo 100 caracteres)' 
          });
          isRunningRef.current = false;
          return;
        }
        
        // Validate characters for Overpass QL safety
        if (!validateOverpassInput(sanitizedQuery)) {
          updateState({ 
            isSearching: false, 
            error: 'La búsqueda contiene caracteres no permitidos' 
          });
          isRunningRef.current = false;
          return;
        }
        
        // Escape special regex characters before interpolation
        const escapedQuery = escapeRegex(sanitizedQuery);
        
        overpassQuery = `
          [out:json][timeout:30];
          (
            node["name"~"${escapedQuery}",i]${categoryFilter !== '["name"]["amenity"]' ? categoryFilter : ''}(${bboxStr});
            way["name"~"${escapedQuery}",i]${categoryFilter !== '["name"]["amenity"]' ? categoryFilter : ''}(${bboxStr});
          );
          out center tags;
        `;
      } else if (params.categoria !== 'all') {
        overpassQuery = `
          [out:json][timeout:30];
          (
            node${categoryFilter}["name"](${bboxStr});
            way${categoryFilter}["name"](${bboxStr});
          );
          out center tags;
        `;
      } else {
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

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      const elements = data.elements || [];

      const businesses: BusinessResult[] = elements
        .filter((el: any) => el.tags?.name)
        .map((el: any) => {
          const tags = el.tags!;
          const lat = el.lat || el.center?.lat || 0;
          const lon = el.lon || el.center?.lon || 0;
          
          const tipo = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.office || tags.craft || 'negocio';
          
          const direccion = [tags['addr:street'], tags['addr:housenumber']]
            .filter(Boolean)
            .join(' ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

          const web = tags.website || tags['contact:website'] || tags.url || null;
          const telefono = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags.mobile || tags['contact:mobile'] || null;
          const email = tags.email || tags['contact:email'] || null;

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
            ciudad: tags['addr:city'] || params.ciudad,
            lat,
            lon,
            web,
            telefono,
            email,
            redesSociales: tieneRedes ? redesSociales : null,
          };
        });

      if (businesses.length === 0) {
        updateState({ 
          isSearching: false, 
          error: 'No se encontraron leads' 
        });
        isRunningRef.current = false;
        return;
      }

      updateState({ totalFound: businesses.length });

      // Process businesses (runs in background)
      await processBusinesses(businesses, params.userId, params.autoSave);

    } catch (error) {
      console.error('Search error:', error);
      updateState({ 
        isSearching: false, 
        isProcessing: false,
        error: 'Error de búsqueda. Inténtalo de nuevo.' 
      });
    } finally {
      isRunningRef.current = false;
    }
  }, [updateState, toast]);

  return (
    <SearchContext.Provider value={{ state, startSearch, stopSearch, resetSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

export { CATEGORIAS, CIUDADES_BBOX };
export const CIUDADES_SALAMANCA = Object.keys(CIUDADES_BBOX);
