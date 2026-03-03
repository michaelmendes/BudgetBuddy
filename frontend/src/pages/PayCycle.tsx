import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate, Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, PiggyBank, ReceiptText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePayCycles } from '@/hooks/useApi';
import api from '@/lib/api';
import { formatCurrency, parseDecimal } from '@/lib/decimal';
import type { CategoryGoal, GoalCompletion, PayCycle } from '@/types/api';
import { cn } from '@/lib/utils';

type CycleOverview = {
  totalSpent: number;
  totalSaved: number;
  goalsHit: number;
  goalsTotal: number;
};

export default function PayCyclePage() {
  const navigate = useNavigate();
  const { data: cycles, isLoading } = usePayCycles();

  const sortedCycles = useMemo(
    () => [...(cycles ?? [])].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()),
    [cycles]
  );

  const overviewQueries = useQueries({
    queries: sortedCycles.map((cycle) => ({
      queryKey: ['payCycleOverview', cycle.id],
      queryFn: async (): Promise<CycleOverview> => {
        const [totals, goals, summary] = await Promise.all([
          api.getTransactionTotals(cycle.id).catch(() => ({ expense: 0, income: 0 })),
          api.getCategoryGoals(cycle.id).catch(() => [] as CategoryGoal[]),
          api.getPayCycleSummary(cycle.id).catch(() => null),
        ]);

        const totalSpent = summary ? parseDecimal(summary.total_expenses) : totals.expense || 0;
        const totalSaved = summary
          ? parseDecimal(summary.total_savings)
          : parseDecimal(cycle.income_amount) - (totals.expense || 0);

        if (summary?.goal_completion) {
          const values = Object.values(summary.goal_completion) as GoalCompletion[];
          const goalsHit = values.filter((goal) => goal.met).length;
          return {
            totalSpent,
            totalSaved,
            goalsHit,
            goalsTotal: values.length,
          };
        }

        const goalsHit = goals.filter((goal) => {
          if (typeof goal.is_over_budget === 'boolean') return !goal.is_over_budget;
          if (typeof goal.completion_percentage === 'number') return goal.completion_percentage <= 100;
          return false;
        }).length;

        return {
          totalSpent,
          totalSaved,
          goalsHit,
          goalsTotal: goals.length,
        };
      },
      enabled: sortedCycles.length > 0,
    })),
  });

  const sections: Array<{ title: string; description: string; cycles: PayCycle[] }> = [
    {
      title: 'Existing Cycles',
      description: 'Currently active cycles that you can still update.',
      cycles: sortedCycles.filter((cycle) => cycle.status === 'active'),
    },
    {
      title: 'Upcoming Cycles',
      description: 'Future cycles that are planned but not started.',
      cycles: sortedCycles.filter((cycle) => cycle.status === 'upcoming'),
    },
    {
      title: 'Closed Cycles',
      description: 'Completed cycles with finalized results.',
      cycles: sortedCycles.filter((cycle) => cycle.status === 'closed'),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!sortedCycles.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">No pay cycles yet</h2>
            <p className="text-muted-foreground">Create your first pay cycle to start tracking budget performance.</p>
          </div>
          <Button asChild>
            <Link to="/cycles/new">Create Pay Cycle</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pay Cycles</h1>
          <p className="text-muted-foreground">Review existing, upcoming, and closed cycles in one place.</p>
        </div>
        <Button asChild>
          <Link to="/cycles/new">Add Pay Cycle</Link>
        </Button>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>

          {section.cycles.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No cycles in this section.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {section.cycles.map((cycle) => {
                const index = sortedCycles.findIndex((item) => item.id === cycle.id);
                const overviewQuery = overviewQueries[index];
                const overview = overviewQuery?.data;

                return (
                  <Card
                    key={cycle.id}
                    className="cursor-pointer transition-colors hover:border-primary/40"
                    onClick={() =>
                      navigate(cycle.status === 'active' ? '/transactions' : `/cycles/${cycle.id}/review`)
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">
                          {format(parseISO(cycle.start_date), 'MMM d, yyyy')} - {format(parseISO(cycle.end_date), 'MMM d, yyyy')}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            cycle.status === 'active' && 'border-primary text-primary',
                            cycle.status === 'closed' && 'border-success text-success',
                            cycle.status === 'upcoming' && 'border-warning text-warning'
                          )}
                        >
                          {cycle.status}
                        </Badge>
                      </div>
                      <CardDescription>Income: {formatCurrency(cycle.income_amount)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {overviewQuery?.isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Skeleton className="h-12" />
                          <Skeleton className="h-12" />
                          <Skeleton className="h-12" />
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Metric label="Total Spent" value={formatCurrency(overview?.totalSpent ?? 0)} icon={ReceiptText} />
                          <Metric label="Total Saved" value={formatCurrency(overview?.totalSaved ?? 0)} icon={PiggyBank} />
                          <Metric
                            label="Goals Hit"
                            value={`${overview?.goalsHit ?? 0}${(overview?.goalsTotal ?? 0) > 0 ? `/${overview?.goalsTotal}` : ''}`}
                            icon={CheckCircle2}
                          />
                        </div>
                      )}
                      {cycle.status === 'active' && (
                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="outline"
                            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/cycles/${cycle.id}/close`);
                            }}
                          >
                            Close Cycle
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ))}

    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
