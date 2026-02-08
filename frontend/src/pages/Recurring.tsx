import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Repeat, Calendar, Pause, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, isValidDecimal } from '@/lib/decimal';
import {
  useRecurringTransactions,
  useCategories,
  useCreateRecurringTransaction,
  useUpdateRecurringTransaction,
  useDeleteRecurringTransaction,
} from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import type { RecurringTransaction } from '@/types/api';
import { CalendarIcon } from 'lucide-react';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const recurringSchema = z.object({
  amount: z.string().refine(isValidDecimal, 'Please enter a valid amount'),
  description: z.string().optional(),
  category_id: z.string().min(1, 'Please select a category'),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  day_of_week: z.number().optional(),
  day_of_month: z.number().optional(),
  start_date: z.date(),
  type: z.enum(['expense', 'income']),
});

type RecurringFormValues = z.infer<typeof recurringSchema>;

export default function RecurringPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  const { toast } = useToast();
  const { data: recurring, isLoading } = useRecurringTransactions();
  const { data: categories } = useCategories();
  const createRecurring = useCreateRecurringTransaction();
  const updateRecurring = useUpdateRecurringTransaction();
  const deleteRecurring = useDeleteRecurringTransaction();

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      amount: '',
      description: '',
      category_id: '',
      frequency: 'monthly',
      start_date: new Date(),
      type: 'expense',
    },
  });

  const frequency = form.watch('frequency');

  const handleOpenDialog = (rec?: RecurringTransaction) => {
    if (rec) {
      setEditingRecurring(rec);
      form.reset({
        amount: rec.amount,
        description: rec.description || '',
        category_id: rec.category_id,
        frequency: rec.frequency,
        day_of_week: rec.day_of_week ?? undefined,
        day_of_month: rec.day_of_month ?? undefined,
        start_date: new Date(rec.start_date),
        type: rec.type,
      });
    } else {
      setEditingRecurring(null);
      form.reset({
        amount: '',
        description: '',
        category_id: '',
        frequency: 'monthly',
        start_date: new Date(),
        type: 'expense',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: RecurringFormValues) => {
    try {
      const data = {
        amount: values.amount,
        description: values.description,
        category_id: values.category_id,
        frequency: values.frequency,
        start_date: format(values.start_date, 'yyyy-MM-dd'),
        type: values.type,
        day_of_week: values.frequency !== 'monthly' ? values.day_of_week : undefined,
        day_of_month: values.frequency === 'monthly' ? values.day_of_month : undefined,
      };

      if (editingRecurring) {
        await updateRecurring.mutateAsync({
          id: editingRecurring.id,
          data,
        });
        toast({ title: 'Recurring transaction updated' });
      } else {
        await createRecurring.mutateAsync(data as any);
        toast({ title: 'Recurring transaction created' });
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (rec: RecurringTransaction) => {
    try {
      await updateRecurring.mutateAsync({
        id: rec.id,
        data: { is_active: !rec.is_active },
      });
      toast({
        title: rec.is_active ? 'Paused' : 'Resumed',
        description: `Recurring transaction ${rec.is_active ? 'paused' : 'resumed'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurring.mutateAsync(id);
      toast({ title: 'Recurring transaction deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const getCategoryById = (id: string) => categories?.find((c) => c.id === id);

  const getFrequencyLabel = (rec: RecurringTransaction) => {
    switch (rec.frequency) {
      case 'weekly':
        return `Every ${rec.day_of_week !== null ? DAYS_OF_WEEK[rec.day_of_week] : 'week'}`;
      case 'biweekly':
        return `Every 2 weeks (${rec.day_of_week !== null ? DAYS_OF_WEEK[rec.day_of_week] : ''})`;
      case 'monthly':
        return `Monthly on the ${rec.day_of_month || 1}${getOrdinalSuffix(rec.day_of_month || 1)}`;
      default:
        return rec.frequency;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recurring Transactions</h1>
          <p className="text-muted-foreground">Set up automatic recurring expenses and income</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Recurring
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRecurring ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}
              </DialogTitle>
              <DialogDescription>
                {editingRecurring
                  ? 'Update the recurring transaction details.'
                  : 'Set up a recurring transaction that will be automatically added each cycle.'}
              </DialogDescription>
            </DialogHeader>
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
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {frequency !== 'monthly' && (
                  <FormField
                    control={form.control}
                    name="day_of_week"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Week</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {frequency === 'monthly' && (
                  <FormField
                    control={form.control}
                    name="day_of_month"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Month</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[...Array(28)].map((_, i) => (
                              <SelectItem key={i + 1} value={(i + 1).toString()}>
                                {i + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
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
                          <CalendarComponent
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
                        <Input placeholder="e.g., Netflix subscription" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRecurring.isPending || updateRecurring.isPending}
                  >
                    {editingRecurring ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recurring List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : recurring?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No recurring transactions set up yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recurring?.map((rec) => {
            const category = getCategoryById(rec.category_id);
            return (
              <Card key={rec.id} className={cn('overflow-hidden', !rec.is_active && 'opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full text-xl',
                          rec.type === 'expense'
                            ? 'bg-muted'
                            : 'bg-success/10'
                        )}
                      >
                        {category?.icon || '📁'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {rec.description || category?.name || 'Recurring'}
                          </p>
                          {!rec.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Paused
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Repeat className="h-3 w-3" />
                          <span>{getFrequencyLabel(rec)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={cn(
                          'text-lg font-semibold',
                          rec.type === 'expense' ? 'text-foreground' : 'text-success'
                        )}
                      >
                        {rec.type === 'expense' ? '-' : '+'}
                        {formatCurrency(rec.amount)}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(rec)}
                        >
                          {rec.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(rec)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(rec.id)}
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

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
