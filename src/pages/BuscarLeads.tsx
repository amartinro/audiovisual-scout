import { useState, useEffect } from 'react';
import { Search, MapPin, Loader2, Building2, Globe, AlertCircle, Phone, Mail, RefreshCw, StopCircle, CheckCircle2, Users } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSearch, CATEGORIAS, CIUDADES_SALAMANCA } from '@/contexts/SearchContext';
import type { UserSettings } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';

export default function BuscarLeads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { state, startSearch, stopSearch, resetSearch } = useSearch();
  
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

  const handleSearch = () => {
    if (!user) return;
    
    startSearch({
      categoria,
      ciudad,
      query,
      userId: user.id,
      autoSave: settings?.auto_save_leads ?? true,
    });
  };

  const isActive = state.isSearching || state.isProcessing;
  const hasResults = state.savedCount > 0 || state.totalFound > 0;
  const isCompleted = !isActive && hasResults && !state.isStopped;

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Leads
          </CardTitle>
          <CardDescription>
            Busca leads reales en Salamanca usando datos de OpenStreetMap.
            Los resultados se guardan automáticamente y se enriquecen con información de contacto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria} disabled={isActive}>
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
              <Select value={ciudad} onValueChange={setCiudad} disabled={isActive}>
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
                onKeyDown={(e) => e.key === 'Enter' && !isActive && handleSearch()}
                disabled={isActive}
              />
            </div>

            <div className="flex items-end gap-2">
              {isActive ? (
                <Button 
                  onClick={stopSearch} 
                  variant="destructive" 
                  className="w-full"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Detener
                </Button>
              ) : (
                <Button onClick={handleSearch} className="w-full">
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Card - Shows when search is active or has results */}
      {(isActive || hasResults) && (
        <Card className={`shadow-card border-2 ${isActive ? 'border-primary' : isCompleted ? 'border-success' : 'border-warning'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {isActive ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Búsqueda en progreso
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Búsqueda completada
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-warning" />
                  Búsqueda detenida
                </>
              )}
            </CardTitle>
            {state.startTime && (
              <CardDescription>
                {state.searchCategoria !== 'all' ? CATEGORIAS.find(c => c.value === state.searchCategoria)?.label : 'Todas las categorías'} 
                {' '}en {state.searchCiudad}
                {state.searchQuery && ` • "${state.searchQuery}"`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold text-primary">{state.totalFound}</div>
                <div className="text-xs text-muted-foreground">Encontrados</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold text-success">{state.savedCount}</div>
                <div className="text-xs text-muted-foreground">Guardados</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold text-info">{state.enrichedCount}</div>
                <div className="text-xs text-muted-foreground">Enriquecidos</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold text-muted-foreground">{state.duplicatesCount}</div>
                <div className="text-xs text-muted-foreground">Duplicados</div>
              </div>
            </div>

            {/* Progress Bar */}
            {isActive && state.totalFound > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="truncate max-w-xs">Procesando: {state.currentBusiness}</span>
                  </div>
                  <span className="font-medium">{state.processedCount} / {state.totalFound}</span>
                </div>
                <Progress value={state.progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {state.progress}% completado • Buscando web, teléfono, email y redes sociales
                </p>
              </div>
            )}

            {/* Searching phase */}
            {state.isSearching && state.totalFound === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Buscando leads en OpenStreetMap...</span>
              </div>
            )}

            {/* Actions when completed */}
            {!isActive && hasResults && (
              <div className="flex flex-wrap gap-2">
                <Link to="/leads">
                  <Button variant="default">
                    <Users className="mr-2 h-4 w-4" />
                    Ver Leads ({state.savedCount})
                  </Button>
                </Link>
                <Button variant="outline" onClick={resetSearch}>
                  <Search className="mr-2 h-4 w-4" />
                  Nueva búsqueda
                </Button>
              </div>
            )}

            {/* Error message */}
            {state.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Búsqueda inteligente:</strong> Los datos provienen de OpenStreetMap y se enriquecen 
          automáticamente buscando información de contacto adicional (web, teléfono, email, redes sociales).
          {settings?.auto_save_leads !== false && ' Los resultados se guardan automáticamente como leads.'}
          <br />
          <span className="text-xs">
            ⚠️ La búsqueda continúa en segundo plano aunque navegues a otras páginas. Vuelve aquí para ver el progreso.
          </span>
        </AlertDescription>
      </Alert>

      {/* Empty State */}
      {!isActive && !hasResults && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Busca leads</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona una categoría y ciudad para encontrar leads
          </p>
        </div>
      )}
    </div>
  );
}
