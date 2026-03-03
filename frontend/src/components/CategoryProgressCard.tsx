import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal } from '@/lib/decimal';
import { ProgressRing } from './ProgressRing';
import type { DashboardCategoryProgress } from '@/types/api';

interface CategoryProgressCardProps {
  progress: DashboardCategoryProgress;
  className?: string;
}

export function CategoryProgressCard({
  progress,
  className,
}: CategoryProgressCardProps) {
  const spent = parseDecimal(progress.spent);
  const totalBudget = parseDecimal(progress.effective_budget);
  const remaining = Math.max(parseDecimal(progress.remaining), 0);
  const rollover = parseDecimal(progress.rollover_amount);
  const percentage = progress.completion_percentage;
  const isOverBudget = progress.is_over_budget;

  // Get icon and color from category
  const iconEmoji = progress.category_icon || '📁';
  
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-all hover:shadow-md',
        isOverBudget && 'border-destructive/30 bg-destructive/5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl" role="img" aria-label={progress.category_name}>
            {iconEmoji}
          </span>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground truncate">{progress.category_name}</h4>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(spent)} / {formatCurrency(totalBudget)}
            </p>
          </div>
        </div>
        <ProgressRing value={percentage} size="sm" showLabel={false} />
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isOverBudget
                ? 'bg-destructive'
                : percentage >= 80
                ? 'bg-warning'
                : 'bg-primary'
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Footer stats */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {isOverBudget ? 'Over by' : 'Remaining'}: {' '}
          <span className={cn('font-medium', isOverBudget ? 'text-destructive' : 'text-foreground')}>
            {formatCurrency(isOverBudget ? Math.abs(parseDecimal(progress.remaining)) : remaining)}
          </span>
        </span>
        {rollover > 0 && (
          <span className="text-success">
            +{formatCurrency(rollover)} rollover
          </span>
        )}
      </div>
    </div>
  );
}
