import { format, differenceInDays, isAfter, isBefore, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal, calculatePercentage } from '@/lib/decimal';
import type { PayCycle } from '@/types/api';

interface PayCycleTimelineProps {
  cycles: PayCycle[];
  activeCycleId?: string;
  onCycleClick?: (cycle: PayCycle) => void;
}

export function PayCycleTimeline({ cycles, activeCycleId, onCycleClick }: PayCycleTimelineProps) {
  // Sort by start date descending
  const sortedCycles = [...cycles].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Pay Cycle Timeline</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {sortedCycles.map((cycle, index) => {
            const isActive = cycle.id === activeCycleId;
            const startDate = parseISO(cycle.start_date);
            const endDate = parseISO(cycle.end_date);
            const today = new Date();
            
            let dayProgress = 0;
            if (cycle.status === 'active') {
              const totalDays = differenceInDays(endDate, startDate) + 1;
              const elapsedDays = differenceInDays(today, startDate) + 1;
              dayProgress = Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100);
            } else if (cycle.status === 'closed') {
              dayProgress = 100;
            }

            return (
              <div
                key={cycle.id}
                className={cn(
                  'relative pl-10 cursor-pointer group',
                  onCycleClick && 'hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors'
                )}
                onClick={() => onCycleClick?.(cycle)}
              >
                {/* Circle indicator */}
                <div
                  className={cn(
                    'absolute left-2 top-1 h-5 w-5 rounded-full border-2 bg-background transition-colors',
                    isActive
                      ? 'border-primary bg-primary'
                      : cycle.status === 'closed'
                      ? 'border-muted-foreground'
                      : 'border-border'
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-1 rounded-full bg-primary-foreground" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {format(startDate, 'MMM d')} – {format(endDate, 'MMM d, yyyy')}
                    </span>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        cycle.status === 'active'
                          ? 'bg-primary/10 text-primary'
                          : cycle.status === 'closed'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-accent text-accent-foreground'
                      )}
                    >
                      {cycle.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Income: {formatCurrency(cycle.income_amount)}</span>
                    {parseDecimal(cycle.rollover_amount) > 0 && (
                      <span className="text-success">
                        +{formatCurrency(cycle.rollover_amount)} rollover
                      </span>
                    )}
                  </div>
                  {cycle.status === 'active' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{Math.round(dayProgress)}% through cycle</span>
                        <span>{differenceInDays(endDate, today)} days left</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${dayProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
