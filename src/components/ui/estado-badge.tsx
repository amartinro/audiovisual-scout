import { cn } from '@/lib/utils';
import type { EstadoLead } from '@/lib/types';

interface EstadoBadgeProps {
  estado: EstadoLead;
}

const estadoConfig: Record<EstadoLead, { label: string; className: string }> = {
  nuevo: {
    label: 'Nuevo',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  contactado: {
    label: 'Contactado',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  respondido: {
    label: 'Respondido',
    className: 'bg-success/10 text-success border-success/20',
  },
  descartado: {
    label: 'Descartado',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const config = estadoConfig[estado];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
