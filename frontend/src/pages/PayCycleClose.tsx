import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, isValidDecimal, parseDecimal } from '@/lib/decimal';
import {
  useCategories,
  useCategoryGoals,
  useClosePayCycle,
  usePayCycle,
  useTransactions,
  useTransactionTotals,
} from '@/hooks/useApi';

function toCents(value: number): number {
  return Math.round(value * 100);
}

export default function PayCycleClosePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const closePayCycle = useClosePayCycle();

  const { data: cycle, isLoading: cycleLoading } = usePayCycle(id);
  const { data: categories } = useCategories();
  const { data: goals, isLoading: goalsLoading } = useCategoryGoals(id);
  const { data: transactions } = useTransactions(id);
  const { data: totals } = useTransactionTotals(id);

  const [actualIncome, setActualIncome] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [allocationsInitialized, setAllocationsInitialized] = useState(false);

  useEffect(() => {
    if (cycle && actualIncome === '') {
      setActualIncome(cycle.income_amount);
    }
  }, [cycle, actualIncome]);

  useEffect(() => {
    setAllocations({});
    setAllocationsInitialized(false);
  }, [id]);

  useEffect(() => {
    if (!categories || !cycle || !goals || allocationsInitialized) return;
  
    const cycleIncome = parseDecimal(cycle.income_amount);
    const goalsByCategoryId = new Map(
      goals.map((goal) => [goal.category_id, goal])
    );
  
    const initial: Record<string, string> = {};
  
    for (const category of categories) {
      const goal = goalsByCategoryId.get(category.id);
  
      if (!goal) {
        initial[category.id] = '0.00';
        continue;
      }
  
      const defaultAmount =
        goal.goal_type === 'percentage'
          ? (parseDecimal(goal.goal_value) / 100) * cycleIncome
          : parseDecimal(goal.goal_value);
  
      initial[category.id] = defaultAmount.toFixed(2);
    }
  
    setAllocations(initial);
    setAllocationsInitialized(true);
  }, [categories, goals, cycle, allocationsInitialized]);

  const expenseTotal = totals?.expense ?? 0;
  const actualIncomeValue = isValidDecimal(actualIncome) ? parseDecimal(actualIncome) : 0;
  const remainder = actualIncomeValue - expenseTotal;

  const categoryRows = useMemo(() => {
    if (!categories) return [];
    const goalsByCategoryId = new Map((goals ?? []).map((goal) => [goal.category_id, goal]));

    const spentByCategoryId = (transactions ?? []).reduce<Record<string, number>>((acc, tx) => {
      const signedAmount = tx.type === 'expense' ? parseDecimal(tx.amount) : -parseDecimal(tx.amount);
      acc[tx.category_id] = (acc[tx.category_id] ?? 0) + signedAmount;
      return acc;
    }, {});

    return categories.map((category) => {
      const goal = goalsByCategoryId.get(category.id);
      // "Start" is only what carried over from the previous cycle.
      const opening = goal ? parseDecimal(goal.rollover_balance) : 0;
      const spent = spentByCategoryId[category.id] ?? 0;
      const carryForward = isValidDecimal(allocations[category.id] ?? '') ? parseDecimal(allocations[category.id]) : 0;
      // Current = start - spent + carry forward allocation.
      const current = opening - spent + carryForward;
      return {
        categoryId: category.id,
        name: category.name,
        icon: category.icon ?? '📁',
        opening,
        spent,
        current,
      };
    });
  }, [categories, goals, transactions, allocations]);

  const allocatedTotal = useMemo(
    () => Object.values(allocations).reduce((sum, value) => sum + (isValidDecimal(value) ? parseDecimal(value) : 0), 0),
    [allocations]
  );
  const unallocatedRemainder = remainder - allocatedTotal;

  const canClose =
    !!cycle &&
    cycle.status !== 'closed' &&
    isValidDecimal(actualIncome) &&
    remainder >= 0 &&
    toCents(unallocatedRemainder) === 0 &&
    !closePayCycle.isPending;

  const handleCloseCycle = async () => {
    if (!cycle || !id) return;
    if (!isValidDecimal(actualIncome)) {
      toast({
        title: 'Invalid income amount',
        description: 'Please enter a valid actual paycheck amount.',
        variant: 'destructive',
      });
      return;
    }

    if (remainder < 0) {
      toast({
        title: 'Cannot close cycle',
        description: 'Expenses exceed the actual paycheck amount.',
        variant: 'destructive',
      });
      return;
    }

    if (toCents(unallocatedRemainder) !== 0) {
      toast({
        title: 'Remainder not fully allocated',
        description: 'Allocate the full remainder across categories before closing.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await closePayCycle.mutateAsync({
        id,
        data: {
          actual_income_amount: actualIncome,
          category_allocations: categoryRows.map((row) => ({
            category_id: row.categoryId,
            amount: allocations[row.categoryId] || '0.00',
          })),
        },
      });
      toast({ title: 'Cycle closed successfully' });
      navigate('/cycles');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to close cycle',
        variant: 'destructive',
      });
    }
  };

  if (cycleLoading || goalsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cycle || !id) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Pay cycle not found.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Close Pay Cycle</h1>
          <p className="text-muted-foreground">
            {format(parseISO(cycle.start_date), 'MMM d, yyyy')} - {format(parseISO(cycle.end_date), 'MMM d, yyyy')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/cycles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pay Cycles
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cycle Totals</CardTitle>
          <CardDescription>Set actual paycheck and review this cycle before closing.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Expected Income</p>
            <p className="text-lg font-semibold">{formatCurrency(cycle.income_amount)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Actual Paycheck</p>
            <Input value={actualIncome} onChange={(event) => setActualIncome(event.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-lg font-semibold">{formatCurrency(expenseTotal)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-semibold">{formatCurrency(remainder)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocate Remaining Amount</CardTitle>
          <CardDescription>
            Divide the remaining paycheck across your categories. You can close only when unallocated remainder is $0.00.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {categoryRows.map((row) => (
                <div key={row.categoryId} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">
                      <span className="mr-2">{row.icon}</span>
                      {row.name}
                    </p>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Start: {formatCurrency(row.opening)}</p>
                      <p>Spent: {formatCurrency(row.spent)}</p>
                      <p>Current: {formatCurrency(row.current)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Carry forward allocation</p>
                    <Input
                      value={allocations[row.categoryId] ?? '0.00'}
                      onChange={(event) =>
                        setAllocations((prev) => ({
                          ...prev,
                          [row.categoryId]: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p>
              Allocated total: <span className="font-semibold text-foreground">{formatCurrency(allocatedTotal)}</span>
            </p>
            <p>
              Unallocated remainder:{' '}
              <span className={`font-semibold ${toCents(unallocatedRemainder) === 0 ? 'text-success' : 'text-warning'}`}>
                {formatCurrency(unallocatedRemainder)}
              </span>
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleCloseCycle} disabled={!canClose}>
              {closePayCycle.isPending ? 'Closing...' : 'Close Cycle'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
