import { AlertCircle, PartyPopper, Lightbulb, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardNudge, Nudge } from '@/types/api';
import { useState } from 'react';

type NudgeLike = Nudge | DashboardNudge;

interface NudgeCardProps {
  nudge: NudgeLike;
  onDismiss?: (id: string) => void;
}

export function NudgeCard({ nudge, onDismiss }: NudgeCardProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.(nudge.id);
  };

  const config = {
    warning: {
      icon: AlertCircle,
      bgClass: 'bg-warning/10 border-warning/30',
      iconClass: 'text-warning',
    },
    celebration: {
      icon: PartyPopper,
      bgClass: 'bg-success/10 border-success/30',
      iconClass: 'text-success',
    },
    tip: {
      icon: Lightbulb,
      bgClass: 'bg-info/10 border-info/30',
      iconClass: 'text-info',
    },
  };

  const { icon: Icon, bgClass, iconClass } = config[nudge.type];

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-lg border p-4 transition-all animate-fade-in',
        bgClass
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{nudge.message}</p>
        {nudge.category_name && (
          <p className="mt-1 text-xs text-muted-foreground">
            Category: {nudge.category_name}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface NudgeListProps {
  nudges: NudgeLike[];
  maxVisible?: number;
  onDismiss?: (id: string) => void;
}

export function NudgeList({ nudges, maxVisible = 3, onDismiss }: NudgeListProps) {
  const visibleNudges = nudges.slice(0, maxVisible);

  if (visibleNudges.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleNudges.map((nudge) => (
        <NudgeCard key={nudge.id} nudge={nudge} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
