import { format, parseISO } from 'date-fns';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Calendar,
  DollarSign,
  PiggyBank,
  Plus,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ProgressRing';
import { NudgeList } from '@/components/NudgeCard';
import { CategoryProgressCard } from '@/components/CategoryProgressCard';
import { PayCycleTimeline } from '@/components/PayCycleTimeline';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercentage, parseDecimal } from '@/lib/decimal';
import { useDashboard } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [dismissedNudgeIds, setDismissedNudgeIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { data: dashboard, isLoading } = useDashboard();

  const activeCycle = dashboard?.active_pay_cycle ?? null;
  const stats = dashboard?.stats ?? null;
  const categoryProgress = dashboard?.category_progress ?? [];
  const visibleCategoryProgress = showAllCategories ? categoryProgress : categoryProgress.slice(0, 6);
  const friendUpdates = dashboard?.friend_updates ?? [];
  const recentCycles = dashboard?.recent_cycles ?? [];
  const visibleNudges = (dashboard?.nudges ?? []).filter((nudge) => !dismissedNudgeIds.includes(nudge.id));

  useEffect(() => {
    setDismissedNudgeIds([]);
  }, [activeCycle?.id]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          {activeCycle ? (
            <p className="text-muted-foreground">
              {format(parseISO(activeCycle.start_date), 'MMM d')} –{' '}
              {format(parseISO(activeCycle.end_date), 'MMM d, yyyy')}
            </p>
          ) : (
            <p className="text-muted-foreground">No active pay cycle</p>
          )}
        </div>
        {activeCycle && (
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link to="/transactions/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Nudges */}
      <NudgeList
        nudges={visibleNudges}
        onDismiss={(id) => setDismissedNudgeIds((current) => [...current, id])}
      />

      {!activeCycle ? (
        <NoCycleState friendUpdates={friendUpdates} />
      ) : (
        <>
          {/* Main Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Budget Used"
              value={formatCurrency(stats?.total_spent)}
              subtitle={`of ${formatCurrency(stats?.total_budget)}`}
              icon={DollarSign}
              trend={
                (stats?.budget_used_percentage ?? 0) > 100
                  ? 'negative'
                  : (stats?.budget_used_percentage ?? 0) > 80
                  ? 'warning'
                  : 'positive'
              }
              trendValue={formatPercentage(stats?.budget_used_percentage, 0)}
            />
            <StatCard
              title="Remaining"
              value={formatCurrency(stats?.remaining)}
              subtitle="available to spend"
              icon={PiggyBank}
              trend={parseDecimal(stats?.remaining) > 0 ? 'positive' : 'negative'}
            />
            <StatCard
              title="Days Left"
              value={String(stats?.days_remaining ?? 0)}
              subtitle={`of ${stats?.total_days ?? 0} days`}
              icon={Calendar}
              progress={stats?.day_progress_percentage}
            />
            <StatCard
              title="Extra Income"
              value={formatCurrency(stats?.extra_income)}
              subtitle="this cycle"
              icon={TrendingUp}
              trend="positive"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Budget Overview</CardTitle>
                  <CardDescription>Track spending across categories</CardDescription>
                </div>
                <ProgressRing value={stats?.budget_used_percentage ?? 0} size="lg" label="spent" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {visibleCategoryProgress.map((progress) => (
                    <CategoryProgressCard key={progress.category_id} progress={progress} />
                  ))}
                </div>
                {categoryProgress.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Add category goals or transactions to see progress here.
                  </p>
                )}
                {categoryProgress.length > 6 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-4"
                    onClick={() => setShowAllCategories((current) => !current)}
                  >
                    {showAllCategories ? 'Show fewer categories' : 'View all categories'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <FriendUpdatesCard friendUpdates={friendUpdates} />
              {recentCycles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PayCycleTimeline
                      cycles={recentCycles}
                      activeCycleId={activeCycle.id}
                      onCycleClick={(cycle) => {
                        if (cycle.status === 'closed') {
                          navigate(`/cycles/${cycle.id}/summary`);
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {!activeCycle && recentCycles.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2" />
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <PayCycleTimeline
                cycles={recentCycles}
                onCycleClick={(cycle) => {
                  if (cycle.status === 'closed') {
                    navigate(`/cycles/${cycle.id}/summary`);
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'positive' | 'negative' | 'warning';
  trendValue?: string;
  progress?: number;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, progress }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm',
                trend === 'positive' && 'text-success',
                trend === 'negative' && 'text-destructive',
                trend === 'warning' && 'text-warning'
              )}
            >
              {trend === 'positive' ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : trend === 'negative' ? (
                <ArrowDownRight className="h-4 w-4" />
              ) : null}
              {trendValue}
            </div>
          )}
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold text-foreground">{value}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {progress !== undefined && (
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}

function NoCycleState({ friendUpdates }: { friendUpdates: import('@/types/api').FriendProgress[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center lg:col-span-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Calendar className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">No Active Pay Cycle</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Create a new pay cycle to start tracking your budget and expenses.
        </p>
        <Button size="lg" asChild>
          <Link to="/cycles/new">
            <Plus className="mr-2 h-5 w-5" />
            Create Pay Cycle
          </Link>
        </Button>
      </div>
      <FriendUpdatesCard friendUpdates={friendUpdates} />
    </div>
  );
}

function FriendUpdatesCard({ friendUpdates }: { friendUpdates: import('@/types/api').FriendProgress[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Friend Updates</CardTitle>
        <CardDescription>Shared progress only, never raw amounts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {friendUpdates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Add friends to see their shared budget progress here.
            </p>
          </div>
        ) : (
          friendUpdates.slice(0, 3).map((friend) => (
            <div key={friend.friend_id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-foreground">{friend.friend_display_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {friend.categories_on_track} on track, {friend.categories_over_budget} over budget
                  </p>
                </div>
                <ProgressRing
                  value={friend.overall_budget_used_percentage}
                  size="sm"
                  label={formatPercentage(friend.overall_budget_used_percentage, 0)}
                />
              </div>
              <div className="mt-4 space-y-2">
                {friend.shared_categories.slice(0, 3).map((category) => (
                  <div key={category.category_id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="mr-2" role="img" aria-label={category.category_name}>
                        {category.category_icon || '📁'}
                      </span>
                      <span className="truncate text-foreground">{category.category_name}</span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-medium',
                        category.is_over_budget
                          ? 'text-destructive'
                          : category.is_on_track
                          ? 'text-success'
                          : 'text-warning'
                      )}
                    >
                      {formatPercentage(category.completion_percentage, 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
