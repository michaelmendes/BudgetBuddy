import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Receipt, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories, usePayCycle, usePayCycleCategoryBalances, usePayCycleSummary, useTransactions } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal } from '@/lib/decimal';

export default function PayCycleReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: cycle, isLoading: cycleLoading } = usePayCycle(id);
  const { data: summary, isLoading: summaryLoading } = usePayCycleSummary(id);
  const { data: categoryBalances, isLoading: balancesLoading } = usePayCycleCategoryBalances(id);
  const { data: categories } = useCategories();
  const { data: transactions, isLoading: txLoading } = useTransactions(
    id,
    categoryFilter !== 'all' ? categoryFilter : undefined,
    typeFilter !== 'all' ? typeFilter : undefined
  );

  const getCategory = (categoryId: string) => categories?.find((category) => category.id === categoryId);

  const filteredTransactions = useMemo(
    () =>
      (transactions ?? []).filter((transaction) => {
        const category = categories?.find((item) => item.id === transaction.category_id);
        const searchTerm = search.toLowerCase();
        return (
          !searchTerm ||
          transaction.description?.toLowerCase().includes(searchTerm) ||
          category?.name.toLowerCase().includes(searchTerm)
        );
      }),
    [transactions, search, categories]
  );

  const actualPaycheckAmount = parseDecimal(cycle?.income_amount);
  const amountSpent = parseDecimal(summary?.total_expenses);
  const amountSaved = parseDecimal(summary?.total_savings);

  const categorySummaryRows = useMemo(() => {
    if (!cycle || cycle.status !== 'closed') return [];

    return (categoryBalances ?? [])
      .map((item) => ({
        categoryId: item.category_id,
        name: item.category_name,
        icon: item.category_icon ?? '📁',
        starting: parseDecimal(item.starting_balance),
        spent: parseDecimal(item.spent),
        allocated: parseDecimal(item.paycheck_allocated),
        total: parseDecimal(item.closing_balance),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cycle, categoryBalances]);

  if (cycleLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Pay cycle not found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pay Cycle Review</h1>
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
          <CardTitle>Cycle Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">Actual Paycheck</p>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(actualPaycheckAmount)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">Amount Saved</p>
              <p className="text-lg font-semibold text-success">{formatCurrency(amountSaved)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">Amount Spent</p>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(amountSpent)}</p>
            </div>
          </div>

          {summaryLoading || balancesLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : cycle.status !== 'closed' ? (
            <p className="text-sm text-muted-foreground">
              Category summary appears after the cycle is closed.
            </p>
          ) : categorySummaryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No category summary available for this cycle.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Starting Balance</th>
                    <th className="px-3 py-2 font-medium">Amount Spent</th>
                    <th className="px-3 py-2 font-medium">Amount Allocated</th>
                    <th className="px-3 py-2 font-medium">Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummaryRows.map((row) => (
                    <tr key={row.categoryId} className="border-t">
                      <td className="px-3 py-2 font-medium text-foreground">
                        <span className="mr-2">{row.icon}</span>
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-foreground">{formatCurrency(row.starting)}</td>
                      <td className="px-3 py-2 text-foreground">{formatCurrency(row.spent)}</td>
                      <td className="px-3 py-2 text-foreground">{formatCurrency(row.allocated)}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by description or category..."
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {txLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Receipt className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No transactions found for this cycle.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => {
                const category = getCategory(transaction.category_id);
                return (
                  <Card key={transaction.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full',
                              transaction.type === 'expense'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-success/10 text-success'
                            )}
                          >
                            {transaction.type === 'expense' ? (
                              <ArrowDownRight className="h-5 w-5" />
                            ) : (
                              <ArrowUpRight className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {transaction.description || category?.name || 'Transaction'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {category?.icon} {category?.name} • {format(new Date(transaction.transaction_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'text-lg font-semibold',
                            transaction.type === 'expense' ? 'text-foreground' : 'text-success'
                          )}
                        >
                          {transaction.type === 'expense' ? '-' : '+'}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
