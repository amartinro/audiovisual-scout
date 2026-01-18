import { MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface GoogleMapsPopupProps {
  direccion: string;
  ciudad?: string;
  className?: string;
}

export function GoogleMapsPopup({ direccion, ciudad, className }: GoogleMapsPopupProps) {
  // Build the Google Maps search query
  const searchQuery = encodeURIComponent(`${direccion}${ciudad ? `, ${ciudad}` : ''}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  const embedUrl = `https://www.google.com/maps?q=${searchQuery}&output=embed`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${className}`}
        >
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate underline-offset-2 hover:underline">{direccion}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="overflow-hidden rounded-lg">
          <iframe
            src={embedUrl}
            width="100%"
            height="200"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Mapa de ${direccion}`}
          />
          <div className="p-3 space-y-2">
            <p className="text-sm font-medium">{direccion}</p>
            {ciudad && <p className="text-xs text-muted-foreground">{ciudad}</p>}
            <Button size="sm" variant="outline" className="w-full" asChild>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir en Google Maps
              </a>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
