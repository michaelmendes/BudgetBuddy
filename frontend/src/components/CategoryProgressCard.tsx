import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal, calculatePercentage } from '@/lib/decimal';
import { ProgressRing } from './ProgressRing';
import type { Category, CategoryGoal } from '@/types/api';

interface CategoryProgressCardProps {
  category: Category;
  goal?: CategoryGoal;
  spent: number;
  className?: string;
}

export function CategoryProgressCard({
  category,
  goal,
  spent,
  className,
}: CategoryProgressCardProps) {
  const budget = goal ? parseDecimal(goal.goal_value) : 0;
  const rollover = goal ? parseDecimal(goal.rollover_balance) : 0;
  const totalBudget = budget + rollover;
  const percentage = totalBudget > 0 ? calculatePercentage(spent, totalBudget) : 0;
  const remaining = Math.max(totalBudget - spent, 0);
  const isOverBudget = spent > totalBudget;

  // Get icon and color from category
  const iconEmoji = category.icon || '📁';
  
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
          <span className="text-2xl" role="img" aria-label={category.name}>
            {iconEmoji}
          </span>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground truncate">{category.name}</h4>
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
            {formatCurrency(isOverBudget ? spent - totalBudget : remaining)}
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
