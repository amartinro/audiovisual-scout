import { useEffect, useState } from 'react';
import { Building2, Users, Mail, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { EstadoBadge } from '@/components/ui/estado-badge';
import { BusinessDetailDialog } from '@/components/business/BusinessDetailDialog';
import type { Business, Lead, DashboardStats, EstadoLead } from '@/lib/types';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalBusinesses: 0,
    totalLeads: 0,
    leadsPorEstado: { nuevo: 0, contactado: 0, respondido: 0, descartado: 0 },
    promedioScore: 0,
  });
  const [recentLeads, setRecentLeads] = useState<(Lead & { business: Business })[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch businesses count and average score
      const { data: businesses, error: bizError } = await supabase
        .from('businesses')
        .select('*');

      if (bizError) throw bizError;

      // Fetch leads with business info
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*, business:businesses(*)')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Calculate stats
      const totalBusinesses = businesses?.length || 0;
      const totalLeads = leads?.length || 0;
      const promedioScore = businesses?.length
        ? Math.round(
            businesses.reduce((sum, b) => sum + (b.potencial_score || 0), 0) / businesses.length
          )
        : 0;

      const leadsPorEstado: Record<EstadoLead, number> = {
        nuevo: 0,
        contactado: 0,
        respondido: 0,
        descartado: 0,
      };

      leads?.forEach((lead) => {
        if (lead.estado && leadsPorEstado[lead.estado as EstadoLead] !== undefined) {
          leadsPorEstado[lead.estado as EstadoLead]++;
        }
      });

      setStats({
        totalBusinesses,
        totalLeads,
        leadsPorEstado,
        promedioScore,
      });

      // Type assertion for leads with business
      const typedLeads = (leads || []).map(lead => ({
        ...lead,
        etiquetas: lead.etiquetas || [],
        business: lead.business as Business
      })) as (Lead & { business: Business })[];
      
      setRecentLeads(typedLeads.slice(0, 5));

      // Top businesses by score
      const sorted = [...(businesses || [])].sort(
        (a, b) => (b.potencial_score || 0) - (a.potencial_score || 0)
      );
      setTopBusinesses(sorted.slice(0, 5) as Business[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Negocios"
          value={stats.totalBusinesses}
          icon={<Building2 className="h-5 w-5" />}
          description="En base de datos"
        />
        <StatsCard
          title="Total Leads"
          value={stats.totalLeads}
          icon={<Users className="h-5 w-5" />}
          description="Guardados"
        />
        <StatsCard
          title="Score Promedio"
          value={stats.promedioScore}
          icon={<TrendingUp className="h-5 w-5" />}
          description="Potencial medio"
        />
        <StatsCard
          title="Leads Nuevos"
          value={stats.leadsPorEstado.nuevo}
          icon={<Mail className="h-5 w-5" />}
          description="Pendientes de contactar"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/buscar">
          <Button>Buscar nuevos negocios</Button>
        </Link>
        <Link to="/leads">
          <Button variant="outline">Ver todos los leads</Button>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Leads Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay leads todavía. Busca negocios y guárdalos como leads.
              </p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/leads?selected=${lead.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{lead.business?.nombre}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {lead.business?.categoria} • {lead.business?.ciudad}
                      </p>
                    </div>
                    <EstadoBadge estado={lead.estado} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Businesses */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Mayor Potencial</CardTitle>
          </CardHeader>
          <CardContent>
            {topBusinesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay negocios todavía. Usa la búsqueda para importar negocios.
              </p>
            ) : (
              <div className="space-y-3">
                {topBusinesses.map((business) => (
                  <div
                    key={business.id}
                    className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedBusiness(business)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{business.nombre}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {business.categoria} • {business.ciudad}
                      </p>
                    </div>
                    <ScoreBadge score={business.potencial_score} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Business Detail Dialog */}
      <BusinessDetailDialog
        business={selectedBusiness}
        open={!!selectedBusiness}
        onOpenChange={(open) => !open && setSelectedBusiness(null)}
      />
    </div>
  );
}
