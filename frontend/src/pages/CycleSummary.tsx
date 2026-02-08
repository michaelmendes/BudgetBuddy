import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  ArrowLeft,
  PartyPopper,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressRing } from '@/components/ProgressRing';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal, formatPercentage, calculatePercentage } from '@/lib/decimal';
import { usePayCycle, usePayCycleSummary, useCategories } from '@/hooks/useApi';

// Mock summary for demo
const mockSummary = {
  id: '1',
  pay_cycle_id: '1',
  total_income: '3500.00',
  total_expenses: '2800.00',
  total_savings: '700.00',
  net_balance: '700.00',
  category_breakdown: {
    '1': { name: 'Groceries', spent: '450.00', budget: '500.00', percentage: 90 },
    '2': { name: 'Dining Out', spent: '280.00', budget: '250.00', percentage: 112 },
    '3': { name: 'Transport', spent: '180.00', budget: '200.00', percentage: 90 },
    '4': { name: 'Entertainment', spent: '150.00', budget: '200.00', percentage: 75 },
    '5': { name: 'Utilities', spent: '220.00', budget: '250.00', percentage: 88 },
  },
  goal_completion: {
    '1': { goal_type: 'fixed', goal_value: '500.00', spent: '450.00', completion_percentage: 90, met: true },
    '2': { goal_type: 'fixed', goal_value: '250.00', spent: '280.00', completion_percentage: 112, met: false },
    '3': { goal_type: 'fixed', goal_value: '200.00', spent: '180.00', completion_percentage: 90, met: true },
    '4': { goal_type: 'percentage', goal_value: '5', spent: '150.00', completion_percentage: 75, met: true },
    '5': { goal_type: 'fixed', goal_value: '250.00', spent: '220.00', completion_percentage: 88, met: true },
  },
  variances: {
    '1': { planned: '500.00', actual: '450.00', variance: '50.00', variance_percentage: -10 },
    '2': { planned: '250.00', actual: '280.00', variance: '-30.00', variance_percentage: 12 },
    '3': { planned: '200.00', actual: '180.00', variance: '20.00', variance_percentage: -10 },
    '4': { planned: '200.00', actual: '150.00', variance: '50.00', variance_percentage: -25 },
    '5': { planned: '250.00', actual: '220.00', variance: '30.00', variance_percentage: -12 },
  },
  rollover_generated: '150.00',
  generated_at: new Date().toISOString(),
};

export default function CycleSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: cycle, isLoading: cycleLoading } = usePayCycle(id);
  const { data: categories } = useCategories();

  // Use mock data for demo
  const summary = mockSummary;

  const totalIncome = parseDecimal(summary.total_income);
  const totalExpenses = parseDecimal(summary.total_expenses);
  const netBalance = parseDecimal(summary.net_balance);
  const rollover = parseDecimal(summary.rollover_generated);

  const goalsCompleted = Object.values(summary.goal_completion).filter((g) => g.met).length;
  const totalGoals = Object.values(summary.goal_completion).length;
  const successRate = calculatePercentage(goalsCompleted, totalGoals);

  const wins = Object.entries(summary.goal_completion)
    .filter(([_, g]) => g.met)
    .map(([catId, g]) => ({
      category: summary.category_breakdown[catId]?.name || 'Unknown',
      underBudget: parseDecimal(summary.category_breakdown[catId]?.budget) - parseDecimal(summary.category_breakdown[catId]?.spent),
    }))
    .filter((w) => w.underBudget > 0)
    .sort((a, b) => b.underBudget - a.underBudget);

  const overBudget = Object.entries(summary.goal_completion)
    .filter(([_, g]) => !g.met)
    .map(([catId, g]) => ({
      category: summary.category_breakdown[catId]?.name || 'Unknown',
      over: parseDecimal(summary.category_breakdown[catId]?.spent) - parseDecimal(summary.category_breakdown[catId]?.budget),
    }));

  if (cycleLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pay Cycle Summary</h1>
          {cycle && (
            <p className="text-muted-foreground">
              {format(parseISO(cycle.start_date), 'MMM d')} –{' '}
              {format(parseISO(cycle.end_date), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </div>

      {/* Celebration Banner */}
      {successRate >= 80 && (
        <Card className="bg-gradient-to-r from-success/10 to-primary/10 border-success/30">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              <PartyPopper className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Great Cycle! 🎉</h2>
              <p className="text-muted-foreground">
                You met {goalsCompleted} out of {totalGoals} goals. Keep up the amazing work!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Net Balance</p>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <p
              className={cn(
                'mt-2 text-2xl font-bold',
                netBalance >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {formatCurrency(netBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Rollover to Next</p>
              <Target className="h-4 w-4 text-info" />
            </div>
            <p className="mt-2 text-2xl font-bold text-success">{formatCurrency(rollover)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Goal Completion</CardTitle>
            <CardDescription>
              {goalsCompleted} of {totalGoals} goals met this cycle
            </CardDescription>
          </div>
          <ProgressRing value={successRate} size="lg" label="met" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(summary.goal_completion).map(([catId, goal]) => {
              const category = summary.category_breakdown[catId];
              if (!category) return null;
              
              return (
                <div
                  key={catId}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-4',
                    goal.met ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {goal.met ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(category.spent)} of {formatCurrency(category.budget)} budget
                      </p>
                    </div>
                  </div>
                  <Badge variant={goal.met ? 'default' : 'destructive'}>
                    {formatPercentage(goal.completion_percentage)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Wins & Areas to Improve */}
      <div className="grid gap-6 lg:grid-cols-2">
        {wins.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-badge-gold" />
                Your Wins
              </CardTitle>
              <CardDescription>Categories where you stayed under budget</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wins.slice(0, 5).map((win, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-medium">{win.category}</span>
                    <Badge variant="secondary" className="bg-success/10 text-success">
                      Saved {formatCurrency(win.underBudget)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {overBudget.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Areas to Improve
              </CardTitle>
              <CardDescription>Categories that went over budget</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overBudget.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-medium">{item.category}</span>
                    <Badge variant="outline" className="text-destructive border-destructive/30">
                      Over by {formatCurrency(item.over)}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                💡 Tip: Consider adjusting your budget or finding ways to reduce spending in these areas next cycle.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Button variant="outline" asChild>
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
        <Button asChild>
          <Link to="/cycles/new">Start New Cycle</Link>
        </Button>
      </div>
    </div>
  );
}
