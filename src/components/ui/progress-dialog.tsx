import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  detail?: string;
}

interface ProgressDialogProps {
  open: boolean;
  title: string;
  steps: ProgressStep[];
  currentProgress?: number;
}

export function ProgressDialog({ open, title, steps, currentProgress }: ProgressDialogProps) {
  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const progress = currentProgress ?? (completedSteps / steps.length) * 100;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Progress value={progress} className="h-2" />
          
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-colors",
                  step.status === 'loading' && "bg-primary/5 border border-primary/20",
                  step.status === 'complete' && "bg-success/5",
                  step.status === 'error' && "bg-destructive/5"
                )}
              >
                <div className="mt-0.5">
                  {step.status === 'pending' && (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  {step.status === 'loading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {step.status === 'complete' && (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                  {step.status === 'error' && (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    step.status === 'pending' && "text-muted-foreground",
                    step.status === 'loading' && "text-foreground",
                    step.status === 'complete' && "text-success",
                    step.status === 'error' && "text-destructive"
                  )}>
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
