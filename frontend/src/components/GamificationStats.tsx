import { Flame, Award, TrendingUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserStats, Badge } from '@/types/api';

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-streak/10 text-streak',
        className
      )}
    >
      <Flame className="h-4 w-4" />
      <span className="font-semibold">{streak}</span>
      <span className="text-sm">day streak</span>
    </div>
  );
}

interface BadgeIconProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function BadgeIcon({ badge, size = 'md', showTooltip = true }: BadgeIconProps) {
  const sizes = {
    sm: 'h-8 w-8 text-base',
    md: 'h-12 w-12 text-xl',
    lg: 'h-16 w-16 text-2xl',
  };

  const tierColors = {
    bronze: 'bg-badge-bronze/20 border-badge-bronze text-badge-bronze',
    silver: 'bg-badge-silver/20 border-badge-silver text-badge-silver',
    gold: 'bg-badge-gold/20 border-badge-gold text-badge-gold',
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full border-2',
        sizes[size],
        tierColors[badge.tier]
      )}
      title={showTooltip ? `${badge.name}: ${badge.description}` : undefined}
    >
      <span role="img" aria-label={badge.name}>
        {badge.icon}
      </span>
    </div>
  );
}

interface GamificationStatsProps {
  stats: UserStats;
  className?: string;
}

export function GamificationStats({ stats, className }: GamificationStatsProps) {
  // Calculate level progress (assume 100 XP per level)
  const xpPerLevel = 100;
  const currentLevelXP = stats.experience_points % xpPerLevel;
  const levelProgress = (currentLevelXP / xpPerLevel) * 100;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Level and XP */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Star className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Level {stats.level}</span>
            <span className="text-xs text-muted-foreground">{stats.experience_points} XP</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Flame}
          iconClass="text-streak"
          label="Current Streak"
          value={`${stats.current_streak} days`}
        />
        <StatCard
          icon={TrendingUp}
          iconClass="text-success"
          label="Longest Streak"
          value={`${stats.longest_streak} days`}
        />
        <StatCard
          icon={Award}
          iconClass="text-primary"
          label="Goals Met"
          value={stats.total_goals_met.toString()}
        />
        <StatCard
          icon={Star}
          iconClass="text-badge-gold"
          label="Badges"
          value={stats.badges.length.toString()}
        />
      </div>

      {/* Recent badges */}
      {stats.badges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Badges</h4>
          <div className="flex flex-wrap gap-2">
            {stats.badges.slice(0, 6).map((badge) => (
              <BadgeIcon key={badge.id} badge={badge} size="sm" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  label: string;
  value: string;
}

function StatCard({ icon: Icon, iconClass, label, value }: StatCardProps) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
