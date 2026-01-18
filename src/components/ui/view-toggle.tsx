import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border rounded-lg p-0.5 bg-muted">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-8 p-0',
          viewMode === 'grid' && 'bg-background shadow-sm'
        )}
        onClick={() => onViewModeChange('grid')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-8 p-0',
          viewMode === 'list' && 'bg-background shadow-sm'
        )}
        onClick={() => onViewModeChange('list')}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
