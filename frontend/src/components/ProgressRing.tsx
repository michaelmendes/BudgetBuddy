import { cn } from '@/lib/utils';

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  colorClass?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 'md',
  strokeWidth,
  className,
  showLabel = true,
  label,
  colorClass,
}: ProgressRingProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const isOverBudget = percentage > 100;
  
  const sizes = {
    sm: { width: 48, stroke: 4, textSize: 'text-xs' },
    md: { width: 80, stroke: 6, textSize: 'text-sm' },
    lg: { width: 120, stroke: 8, textSize: 'text-lg' },
  };
  
  const { width, stroke, textSize } = sizes[size];
  const actualStroke = strokeWidth || stroke;
  const radius = (width - actualStroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  // Determine color based on percentage
  const getStrokeClass = () => {
    if (colorClass) return colorClass;
    if (isOverBudget) return 'stroke-destructive';
    if (percentage >= 80) return 'stroke-warning';
    return 'stroke-primary';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={width} height={width} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          strokeWidth={actualStroke}
          className="stroke-muted"
        />
        {/* Progress circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          strokeWidth={actualStroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-all duration-500 ease-out', getStrokeClass())}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-semibold', textSize)}>
            {Math.round(percentage)}%
          </span>
          {label && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}
