import { format, differenceInDays, parseISO } from 'date-fns';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Calendar,
  DollarSign,
  PiggyBank,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ProgressRing';
import { NudgeList } from '@/components/NudgeCard';
import { CategoryProgressCard } from '@/components/CategoryProgressCard';
import { PayCycleTimeline } from '@/components/PayCycleTimeline';
import { GamificationStats, StreakBadge } from '@/components/GamificationStats';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal, calculatePercentage } from '@/lib/decimal';
import {
  useActivePayCycle,
  usePayCycles,
  useCategories,
  useCategoryGoals,
  useCategoryTotals,
  useTransactionTotals,
  useUserStats,
  useNudges,
} from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useNavigate } from 'react-router-dom';

// Mock data for demo purposes (remove when backend is connected)
const mockNudges = [
  {
    id: '1',
    type: 'warning' as const,
    message: "You're 80% through your Dining Out budget with 10 days left.",
    category_name: 'Dining Out',
    category_id: '1',
    percentage: 80,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'celebration' as const,
    message: "Great job! You've stayed under budget for Groceries this cycle! 🎉",
    category_name: 'Groceries',
    category_id: '2',
    created_at: new Date().toISOString(),
  },
];

const mockStats = {
  current_streak: 14,
  longest_streak: 21,
  total_goals_met: 45,
  badges: [
    { id: '1', name: 'First Saver', description: 'Completed first budget cycle', icon: '🏆', tier: 'gold' as const, earned_at: '' },
    { id: '2', name: 'Week Warrior', description: '7-day streak', icon: '⚡', tier: 'silver' as const, earned_at: '' },
    { id: '3', name: 'Budget Master', description: 'Under budget 3 months in a row', icon: '💰', tier: 'bronze' as const, earned_at: '' },
  ],
  level: 5,
  experience_points: 475,
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: activeCycle, isLoading: cycleLoading } = useActivePayCycle();
  const { data: allCycles } = usePayCycles();
  const { data: categories } = useCategories();
  const { data: categoryGoals } = useCategoryGoals(activeCycle?.id);
  const { data: categoryTotals } = useCategoryTotals(activeCycle?.id);
  const { data: totals } = useTransactionTotals(activeCycle?.id);

  // Calculate overall stats
  const income = activeCycle ? parseDecimal(activeCycle.income_amount) : 0;
  const rollover = activeCycle ? parseDecimal(activeCycle.rollover_amount) : 0;
  const totalBudget = income + rollover;
  const totalSpent = totals?.expense || 0;
  const totalIncome = totals?.income || 0;
  const remaining = totalBudget - totalSpent + totalIncome;
  const budgetUsedPercentage = totalBudget > 0 ? calculatePercentage(totalSpent, totalBudget) : 0;

  // Calculate days remaining
  const daysRemaining = activeCycle
    ? differenceInDays(parseISO(activeCycle.end_date), new Date())
    : 0;
  const totalDays = activeCycle
    ? differenceInDays(parseISO(activeCycle.end_date), parseISO(activeCycle.start_date)) + 1
    : 1;
  const dayProgress = ((totalDays - daysRemaining) / totalDays) * 100;

  // Get category progress data
  const categoryProgress = categories?.map((cat) => {
    const goal = categoryGoals?.find((g) => g.category_id === cat.id);
    const spent = categoryTotals?.[cat.id] || 0;
    return { category: cat, goal, spent };
  }) || [];

  if (cycleLoading) {
    return <DashboardSkeleton />;
  }

  if (!activeCycle) {
    return <NoCycleState />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(parseISO(activeCycle.start_date), 'MMM d')} –{' '}
            {format(parseISO(activeCycle.end_date), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StreakBadge streak={mockStats.current_streak} />
          <Button asChild>
            <Link to="/transactions/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Link>
          </Button>
        </div>
      </div>

      {/* Nudges */}
      <NudgeList nudges={mockNudges} />

      {/* Main Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Budget Used"
          value={formatCurrency(totalSpent)}
          subtitle={`of ${formatCurrency(totalBudget)}`}
          icon={DollarSign}
          trend={budgetUsedPercentage > 100 ? 'negative' : budgetUsedPercentage > 80 ? 'warning' : 'positive'}
          trendValue={`${Math.round(budgetUsedPercentage)}%`}
        />
        <StatCard
          title="Remaining"
          value={formatCurrency(remaining)}
          subtitle="available to spend"
          icon={PiggyBank}
          trend={remaining > 0 ? 'positive' : 'negative'}
        />
        <StatCard
          title="Days Left"
          value={daysRemaining.toString()}
          subtitle={`of ${totalDays} days`}
          icon={Calendar}
          progress={dayProgress}
        />
        <StatCard
          title="Extra Income"
          value={formatCurrency(totalIncome)}
          subtitle="this cycle"
          icon={TrendingUp}
          trend="positive"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Budget Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Budget Overview</CardTitle>
              <CardDescription>Track spending across categories</CardDescription>
            </div>
            <ProgressRing value={budgetUsedPercentage} size="lg" label="spent" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {categoryProgress.slice(0, 6).map(({ category, goal, spent }) => (
                <CategoryProgressCard
                  key={category.id}
                  category={category}
                  goal={goal}
                  spent={spent}
                />
              ))}
            </div>
            {categoryProgress.length > 6 && (
              <Button variant="ghost" className="w-full mt-4" asChild>
                <Link to="/categories">View all categories</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Gamification & Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <GamificationStats stats={mockStats} />
            </CardContent>
          </Card>

          {allCycles && allCycles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <PayCycleTimeline
                  cycles={allCycles.slice(0, 5)}
                  activeCycleId={activeCycle?.id}
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

function NoCycleState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
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
  );
}
