import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Search, Receipt, ArrowUpRight, ArrowDownRight, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, isValidDecimal } from '@/lib/decimal';
import {
  useActivePayCycle,
  useTransactions,
  useCategories,
  useCreateTransactionsBatch,
  useUpdateTransaction,
  useDeleteTransaction,
} from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/types/api';
import { CalendarIcon } from 'lucide-react';

const transactionSchema = z.object({
  amount: z.string().refine(isValidDecimal, 'Please enter a valid amount'),
  description: z.string().optional(),
  category_id: z.string().min(1, 'Please select a category'),
  transaction_date: z.date(),
  type: z.enum(['expense', 'income']),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;
type BatchTransactionRow = { amount: string; transaction_date: string; description: string };

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [batchType, setBatchType] = useState<'expense' | 'income'>('expense');
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [batchRows, setBatchRows] = useState<BatchTransactionRow[]>([{ amount: '', transaction_date: '', description: '' }]);

  const { toast } = useToast();
  const { data: activeCycle } = useActivePayCycle();
  const { data: transactions, isLoading } = useTransactions(
    activeCycle?.id,
    categoryFilter !== 'all' ? categoryFilter : undefined,
    typeFilter !== 'all' ? typeFilter : undefined
  );
  const { data: categories } = useCategories();
  const createTransactionsBatch = useCreateTransactionsBatch();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const getDefaultTransactionDateIso = () => {
    if (!activeCycle) return format(new Date(), 'yyyy-MM-dd');
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    return todayIso > activeCycle.end_date ? activeCycle.end_date : todayIso;
  };

  const getDefaultTransactionDate = () => {
    const defaultIso = getDefaultTransactionDateIso();
    return new Date(`${defaultIso}T12:00:00`);
  };

  const getEmptyBatchRow = (): BatchTransactionRow => ({
    amount: '',
    transaction_date: getDefaultTransactionDateIso(),
    description: '',
  });

  const resetBatchForm = () => {
    setBatchType('expense');
    setBatchCategoryId('');
    setBatchRows([getEmptyBatchRow()]);
  };

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: '',
      description: '',
      category_id: '',
      transaction_date: getDefaultTransactionDate(),
      type: 'expense',
    },
  });

  const handleOpenDialog = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      resetBatchForm();
      form.reset({
        amount: transaction.amount,
        description: transaction.description || '',
        category_id: transaction.category_id,
        transaction_date: new Date(transaction.transaction_date),
        type: transaction.type,
      });
    } else {
      setEditingTransaction(null);
      resetBatchForm();
      form.reset({
        amount: '',
        description: '',
        category_id: '',
        transaction_date: getDefaultTransactionDate(),
        type: 'expense',
      });
    }
    setIsDialogOpen(true);
  };

  const addBatchRow = () => {
    setBatchRows((current) => [...current, getEmptyBatchRow()]);
  };

  const updateBatchRow = (
    index: number,
    field: keyof BatchTransactionRow,
    value: string
  ) => {
    setBatchRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const removeBatchRow = (index: number) => {
    setBatchRows((current) => (current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)));
  };

  const handleBatchSubmit = async () => {
    if (!activeCycle) return;

    if (!batchCategoryId) {
      toast({ title: 'Error', description: 'Please select a category', variant: 'destructive' });
      return;
    }

    const hasInvalidRow = batchRows.some((row) => !row.amount || !row.transaction_date || !isValidDecimal(row.amount));
    if (hasInvalidRow) {
      toast({
        title: 'Error',
        description: 'Each row must include a valid amount and date',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createTransactionsBatch.mutateAsync({
        pay_cycle_id: activeCycle.id,
        category_id: batchCategoryId,
        type: batchType,
        transactions: batchRows.map((row) => ({
          amount: row.amount,
          transaction_date: row.transaction_date,
          description: row.description || undefined,
        })),
      });

      toast({
        title: result.length > 1 ? `${result.length} transactions created` : 'Transaction created',
      });
      setIsDialogOpen(false);
      setEditingTransaction(null);
      resetBatchForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (values: TransactionFormValues) => {
    if (!activeCycle) return;

    try {
      if (editingTransaction) {
        await updateTransaction.mutateAsync({
          id: editingTransaction.id,
          data: {
            amount: values.amount,
            description: values.description,
            category_id: values.category_id,
            transaction_date: format(values.transaction_date, 'yyyy-MM-dd'),
            type: values.type,
          },
        });
        toast({ title: 'Transaction updated' });
      }
      setIsDialogOpen(false);
      resetBatchForm();
      form.reset({
        amount: '',
        description: '',
        category_id: '',
        transaction_date: getDefaultTransactionDate(),
        type: 'expense',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction.mutateAsync(id);
      toast({ title: 'Transaction deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const getCategoryById = (id: string) => categories?.find((c) => c.id === id);

  // Filter by search
  const filteredTransactions = transactions?.filter((t) =>
    t.description?.toLowerCase().includes(search.toLowerCase()) ||
    getCategoryById(t.category_id)?.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!activeCycle) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">No Active Pay Cycle</h2>
        <p className="text-muted-foreground mb-4">Create a pay cycle first to add transactions.</p>
        <Button asChild>
          <Link to="/cycles/new">Create Pay Cycle</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">Manage your income and expenses</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
              </DialogTitle>
              <DialogDescription>
                {editingTransaction
                  ? 'Update the transaction details.'
                  : 'Add a new transaction to your current pay cycle.'}
              </DialogDescription>
            </DialogHeader>
            {editingTransaction ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="transaction_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="What was this for?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateTransaction.isPending}>
                      Update Transaction
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Type</p>
                  <Select
                    value={batchType}
                    onValueChange={(value: 'expense' | 'income') => setBatchType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Category</p>
                  <Select value={batchCategoryId} onValueChange={setBatchCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Transactions</p>
                    <Button type="button" variant="outline" size="sm" onClick={addBatchRow}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Row
                    </Button>
                  </div>
                  <div className="max-h-[40vh] space-y-2 overflow-y-auto px-1 pb-1 pr-2">
                    <div className="grid grid-cols-12 gap-2 px-1 text-xs text-muted-foreground">
                      <span className="col-span-3">Amount</span>
                      <span className="col-span-3">Date</span>
                      <span className="col-span-5">Description (optional)</span>
                      <span className="col-span-1" />
                    </div>
                    {batchRows.map((row, index) => (
                      <div key={`batch-row-${index}`} className="grid grid-cols-12 gap-2">
                        <Input
                          className="col-span-3"
                          placeholder="0.00"
                          value={row.amount}
                          onChange={(event) => updateBatchRow(index, 'amount', event.target.value)}
                        />
                        <Input
                          className="col-span-3"
                          type="date"
                          value={row.transaction_date}
                          onChange={(event) => updateBatchRow(index, 'transaction_date', event.target.value)}
                        />
                        <Input
                          className="col-span-5"
                          placeholder="What was this for?"
                          value={row.description}
                          onChange={(event) => updateBatchRow(index, 'description', event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1"
                          onClick={() => removeBatchRow(index)}
                          disabled={batchRows.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleBatchSubmit} disabled={createTransactionsBatch.isPending}>
                    Add Transaction(s)
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filteredTransactions?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No transactions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTransactions?.map((transaction) => {
            const category = getCategoryById(transaction.category_id);
            return (
              <Card key={transaction.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{category?.icon} {category?.name}</span>
                          <span>•</span>
                          <span>{format(new Date(transaction.transaction_date), 'MMM d')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={cn(
                          'text-lg font-semibold',
                          transaction.type === 'expense' ? 'text-foreground' : 'text-success'
                        )}
                      >
                        {transaction.type === 'expense' ? '-' : '+'}
                        {formatCurrency(transaction.amount)}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(transaction)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(transaction.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
