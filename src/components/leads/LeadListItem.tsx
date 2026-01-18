import { Globe, Phone, Mail, Instagram, Facebook, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { EstadoBadge } from '@/components/ui/estado-badge';
import { GoogleMapsPopup } from '@/components/ui/google-maps-popup';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Business, Lead, RedesSociales } from '@/lib/types';

interface LeadWithBusiness extends Lead {
  business: Business;
}

interface LeadListItemProps {
  lead: LeadWithBusiness;
  onClick: () => void;
}

const parseRedesSociales = (redes: RedesSociales): { instagram?: string; facebook?: string; twitter?: string; linkedin?: string } => {
  if (!redes) return {};
  return redes as { instagram?: string; facebook?: string; twitter?: string; linkedin?: string };
};

export function LeadListItem({ lead, onClick }: LeadListItemProps) {
  const redes = parseRedesSociales(lead.business?.redes_sociales);

  return (
    <div
      className="flex items-center gap-4 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      {/* Score */}
      <div className="flex items-center gap-1">
        <ScoreBadge score={lead.business?.potencial_score || 0} />
        {lead.business?.motivo_scoring && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">{lead.business.motivo_scoring}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Name & Category */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{lead.business?.nombre}</h3>
          <span className="text-xs text-muted-foreground">{lead.business?.categoria}</span>
        </div>
        <GoogleMapsPopup 
          direccion={lead.business?.direccion || lead.business?.ciudad || ''} 
          ciudad={lead.business?.ciudad}
        />
      </div>

      {/* Estado */}
      <EstadoBadge estado={lead.estado} />

      {/* Contact Icons */}
      <div className="flex items-center gap-1">
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
      </div>

      {/* Tags */}
      {lead.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lead.etiquetas.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {lead.etiquetas.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{lead.etiquetas.length - 2}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
