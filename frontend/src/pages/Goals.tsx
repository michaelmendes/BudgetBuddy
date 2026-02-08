import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Target, Pencil, Trash2, TrendingUp, Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDecimal, isValidDecimal, calculatePercentage } from '@/lib/decimal';
import {
  useLongTermGoals,
  useCreateLongTermGoal,
  useUpdateLongTermGoal,
  useContributeToLongTermGoal,
  useDeleteLongTermGoal,
} from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import type { LongTermGoal } from '@/types/api';
import { CalendarIcon } from 'lucide-react';

const goalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  target_amount: z.string().refine(isValidDecimal, 'Please enter a valid amount'),
  target_date: z.date().optional(),
});

type GoalFormValues = z.infer<typeof goalSchema>;

const contributeSchema = z.object({
  amount: z.string().refine(isValidDecimal, 'Please enter a valid amount'),
});

type ContributeFormValues = z.infer<typeof contributeSchema>;

export default function GoalsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<LongTermGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<LongTermGoal | null>(null);

  const { toast } = useToast();
  const { data: goals, isLoading } = useLongTermGoals();
  const createGoal = useCreateLongTermGoal();
  const updateGoal = useUpdateLongTermGoal();
  const contributeToGoal = useContributeToLongTermGoal();
  const deleteGoal = useDeleteLongTermGoal();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      description: '',
      target_amount: '',
    },
  });

  const contributeForm = useForm<ContributeFormValues>({
    resolver: zodResolver(contributeSchema),
    defaultValues: {
      amount: '',
    },
  });

  const handleOpenDialog = (goal?: LongTermGoal) => {
    if (goal) {
      setEditingGoal(goal);
      form.reset({
        name: goal.name,
        description: goal.description || '',
        target_amount: goal.target_amount,
        target_date: goal.target_date ? new Date(goal.target_date) : undefined,
      });
    } else {
      setEditingGoal(null);
      form.reset({
        name: '',
        description: '',
        target_amount: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: GoalFormValues) => {
    try {
      const data = {
        name: values.name,
        description: values.description,
        target_amount: values.target_amount,
        target_date: values.target_date ? format(values.target_date, 'yyyy-MM-dd') : undefined,
      };

      if (editingGoal) {
        await updateGoal.mutateAsync({
          id: editingGoal.id,
          data,
        });
        toast({ title: 'Goal updated' });
      } else {
        await createGoal.mutateAsync(data);
        toast({ title: 'Goal created! Keep saving! 🎯' });
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

  const handleContribute = async (values: ContributeFormValues) => {
    if (!contributingGoal) return;

    try {
      await contributeToGoal.mutateAsync({
        id: contributingGoal.id,
        amount: values.amount,
      });
      toast({ title: `Added ${formatCurrency(values.amount)} to ${contributingGoal.name}! 🎉` });
      setContributingGoal(null);
      contributeForm.reset();
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
      await deleteGoal.mutateAsync(id);
      toast({ title: 'Goal deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const activeGoals = goals?.filter((g) => !g.is_completed) || [];
  const completedGoals = goals?.filter((g) => g.is_completed) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Long-term Goals</h1>
          <p className="text-muted-foreground">Track your savings towards big dreams</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGoal ? 'Edit Goal' : 'Create a New Goal'}</DialogTitle>
              <DialogDescription>
                {editingGoal
                  ? 'Update your savings goal.'
                  : "What are you saving for? We'll help you track your progress."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Emergency Fund, New Car, Vacation" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Amount</FormLabel>
                      <FormControl>
                        <Input placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Target Date (optional)</FormLabel>
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
                            disabled={(date) => date < new Date()}
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
                        <Textarea
                          placeholder="Why is this goal important to you?"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createGoal.isPending || updateGoal.isPending}>
                    {editingGoal ? 'Update' : 'Create'} Goal
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Contribute Dialog */}
        <Dialog open={!!contributingGoal} onOpenChange={(open) => !open && setContributingGoal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to {contributingGoal?.name}</DialogTitle>
              <DialogDescription>
                How much would you like to contribute?
              </DialogDescription>
            </DialogHeader>
            <Form {...contributeForm}>
              <form onSubmit={contributeForm.handleSubmit(handleContribute)} className="space-y-4">
                <FormField
                  control={contributeForm.control}
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
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setContributingGoal(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={contributeToGoal.isPending}>
                    Add Contribution
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Goals */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : activeGoals.length === 0 && completedGoals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No goals yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-1">
              Create your first savings goal to start tracking progress towards your dreams.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Active Goals</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => handleOpenDialog(goal)}
                    onDelete={() => handleDelete(goal.id)}
                    onContribute={() => setContributingGoal(goal)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Completed 🎉</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={() => handleDelete(goal.id)}
                    completed
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface GoalCardProps {
  goal: LongTermGoal;
  completed?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  onContribute?: () => void;
}

function GoalCard({ goal, completed, onEdit, onDelete, onContribute }: GoalCardProps) {
  const current = parseDecimal(goal.current_amount);
  const target = parseDecimal(goal.target_amount);
  const percentage = calculatePercentage(current, target);
  const remaining = Math.max(target - current, 0);

  return (
    <Card className={cn(completed && 'bg-success/5 border-success/30')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {completed ? (
              <Gift className="h-5 w-5 text-success" />
            ) : (
              <Target className="h-5 w-5 text-primary" />
            )}
            <h3 className="font-semibold text-foreground">{goal.name}</h3>
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {goal.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{goal.description}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(percentage)}%</span>
          </div>
          <Progress value={Math.min(percentage, 100)} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{formatCurrency(current)}</span>
            <span className="text-muted-foreground">of {formatCurrency(target)}</span>
          </div>
        </div>

        {goal.target_date && (
          <p className="mt-3 text-xs text-muted-foreground">
            Target: {format(new Date(goal.target_date), 'MMM d, yyyy')}
          </p>
        )}

        {!completed && onContribute && (
          <Button variant="outline" size="sm" className="w-full mt-4" onClick={onContribute}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Add Contribution
          </Button>
        )}

        {completed && goal.completed_at && (
          <p className="mt-3 text-xs text-success font-medium">
            Completed on {format(new Date(goal.completed_at), 'MMM d, yyyy')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
