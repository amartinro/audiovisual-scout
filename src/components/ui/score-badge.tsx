import { cn } from '@/lib/utils';
import { getScoreColor, getScoreLabel } from '@/lib/scoring';

interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, showLabel = false, size = 'md' }: ScoreBadgeProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  const colorClasses = {
    high: 'bg-success/10 text-success border-success/20',
    medium: 'bg-warning/10 text-warning border-warning/20',
    low: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center justify-center rounded-full border font-semibold',
          sizeClasses[size],
          colorClasses[color]
        )}
      >
        {score}
      </div>
      {showLabel && (
        <span
          className={cn(
            'text-sm font-medium',
            color === 'high' && 'text-success',
            color === 'medium' && 'text-warning',
            color === 'low' && 'text-destructive'
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
