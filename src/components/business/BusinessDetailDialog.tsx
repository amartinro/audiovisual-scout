import { Globe, MapPin, Phone, Mail, Instagram, Facebook, Twitter, Linkedin, Youtube, Building2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/ui/score-badge';
import type { Business, RedesSociales } from '@/lib/types';

interface BusinessDetailDialogProps {
  business: Business | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BusinessDetailDialog({ business, open, onOpenChange }: BusinessDetailDialogProps) {
  if (!business) return null;

  const parseRedesSociales = (redes: RedesSociales): Record<string, string | undefined> => {
    if (!redes) return {};
    return redes as Record<string, string | undefined>;
  };

  const redes = parseRedesSociales(business.redes_sociales);

  const socialLinks = [
    { key: 'instagram', icon: Instagram, label: 'Instagram', color: 'bg-pink-100 text-pink-700 hover:bg-pink-200' },
    { key: 'facebook', icon: Facebook, label: 'Facebook', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { key: 'twitter', icon: Twitter, label: 'Twitter', color: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
    { key: 'linkedin', icon: Linkedin, label: 'LinkedIn', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { key: 'youtube', icon: Youtube, label: 'YouTube', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
    { key: 'tiktok', icon: Globe, label: 'TikTok', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-4 pr-6">
            <span className="truncate">{business.nombre}</span>
            <ScoreBadge score={business.potencial_score} showLabel />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-sm">
              <Building2 className="mr-1.5 h-4 w-4" />
              {business.categoria}
            </span>
            <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-sm capitalize">
              {business.tamano_estimado}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div>
              <p>{business.direccion}</p>
              <p className="text-muted-foreground">{business.ciudad}, {business.provincia}</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Contacto</h4>
            <div className="flex flex-wrap gap-2">
              {business.web && (
                <a
                  href={business.web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md bg-success/10 text-success px-3 py-1.5 text-sm hover:bg-success/20"
                >
                  <Globe className="mr-1.5 h-4 w-4" />
                  Ver Web
                </a>
              )}
              {business.telefono && (
                <a
                  href={`tel:${business.telefono}`}
                  className="inline-flex items-center rounded-md bg-info/10 text-info px-3 py-1.5 text-sm hover:bg-info/20"
                >
                  <Phone className="mr-1.5 h-4 w-4" />
                  {business.telefono}
                </a>
              )}
              {business.email && (
                <a
                  href={`mailto:${business.email}`}
                  className="inline-flex items-center rounded-md bg-info/10 text-info px-3 py-1.5 text-sm hover:bg-info/20"
                >
                  <Mail className="mr-1.5 h-4 w-4" />
                  {business.email}
                </a>
              )}
            </div>
          </div>

          {/* Social Media */}
          {Object.keys(redes).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Redes Sociales</h4>
              <div className="flex flex-wrap gap-2">
                {socialLinks.map(({ key, icon: Icon, label, color }) => 
                  redes[key] && (
                    <a
                      key={key}
                      href={redes[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm ${color}`}
                    >
                      <Icon className="mr-1.5 h-4 w-4" />
                      {label}
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          {/* Scores */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <h4 className="text-sm font-medium text-muted-foreground">Puntuaciones</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Potencial</p>
                <p className="text-lg font-semibold">{business.potencial_score}/100</p>
              </div>
              <div>
                <p className="text-muted-foreground">Presencia Digital</p>
                <p className="text-lg font-semibold">{business.presencia_digital_score}/100</p>
              </div>
            </div>
          </div>

          {/* Source */}
          <p className="text-xs text-muted-foreground">
            Fuente: {business.fuente_datos} • Añadido: {new Date(business.created_at).toLocaleDateString('es-ES')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
