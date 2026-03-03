import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { isValidDecimal } from '@/lib/decimal';
import {
  useCategories,
  useCategoryGoals,
  useCreateCategoryGoal,
  useUpdateCategoryGoal,
} from '@/hooks/useApi';

type GoalDraft = {
  goalType: 'fixed' | 'percentage';
  goalValue: string;
};

export default function SetupGoalAmountsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: savedGoals, isLoading: goalsLoading } = useCategoryGoals(undefined);
  const createCategoryGoal = useCreateCategoryGoal();
  const updateCategoryGoal = useUpdateCategoryGoal();
  const [goals, setGoals] = useState<Record<string, GoalDraft>>({});

  useEffect(() => {
    if (!categories) return;
    const byCategory = new Map((savedGoals ?? []).map((item) => [item.category_id, item]));
    const initial: Record<string, GoalDraft> = {};
    for (const category of categories) {
      const savedGoal = byCategory.get(category.id);
      initial[category.id] = {
        goalType: savedGoal?.goal_type || 'fixed',
        goalValue: savedGoal?.goal_value || '0.00',
      };
    }
    setGoals(initial);
  }, [categories, savedGoals]);

  const hasInvalid = useMemo(
    () =>
      Object.values(goals).some(
        ({ goalType, goalValue }) =>
          !isValidDecimal(goalValue) || (goalType === 'percentage' && Number(goalValue) > 100)
      ),
    [goals]
  );

  const handleContinue = async () => {
    if (!categories?.length) {
      toast({
        title: 'No categories',
        description: 'Add categories before setting goal amounts.',
        variant: 'destructive',
      });
      return;
    }
    if (hasInvalid) {
      toast({
        title: 'Invalid amount',
        description: 'Please fix invalid goal fields before continuing.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const goalsByCategoryId = new Map((savedGoals ?? []).map((goal) => [goal.category_id, goal]));

      await Promise.all(
        categories.map(async (category) => {
          const draft = goals[category.id] || { goalType: 'fixed', goalValue: '0.00' };
          const existingGoal = goalsByCategoryId.get(category.id);

          if (existingGoal) {
            return updateCategoryGoal.mutateAsync({
              id: existingGoal.id,
              data: {
                goal_type: draft.goalType,
                goal_value: draft.goalValue,
              },
            });
          }

          return createCategoryGoal.mutateAsync({
            category_id: category.id,
            goal_type: draft.goalType,
            goal_value: draft.goalValue,
          });
        })
      );
      navigate('/setup/starting-amounts');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save goal amounts',
        variant: 'destructive',
      });
    }
  };

  if (categoriesLoading || goalsLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Setup: Goal Amounts</CardTitle>
          <CardDescription>
            <span className="block">
              Step 2 of 3. Set how much you want to contribute to each category every pay cycle.
            </span>
            <span className="block">
              Choose a fixed amount or a percent of each paycheck.
            </span>
          </CardDescription>

        </CardHeader>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          {!categories?.length ? (
            <p className="text-sm text-muted-foreground">No categories found. Go back and add categories first.</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_170px_160px]">
                <div className="flex items-center gap-2 self-center">
                  <span>{category.icon || '📁'}</span>
                  <div>
                    <p className="font-medium">{category.name}</p>
                  </div>
                </div>
                <Select
                  value={goals[category.id]?.goalType ?? 'fixed'}
                  onValueChange={(value: 'fixed' | 'percentage') =>
                    setGoals((prev) => ({
                      ...prev,
                      [category.id]: {
                        goalType: value,
                        goalValue: prev[category.id]?.goalValue ?? '0.00',
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  {goals[category.id]?.goalType === 'fixed' ? (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                  ) : null}
                  <Input
                    className={goals[category.id]?.goalType === 'fixed' ? 'pl-7 pr-8' : 'pr-8'}
                    value={goals[category.id]?.goalValue ?? '0.00'}
                    onChange={(event) =>
                      setGoals((prev) => ({
                        ...prev,
                        [category.id]: {
                          goalType: prev[category.id]?.goalType ?? 'fixed',
                          goalValue: event.target.value,
                        },
                      }))
                    }
                    placeholder={goals[category.id]?.goalType === 'percentage' ? 'e.g., 15' : '0.00'}
                  />
                  {goals[category.id]?.goalType === 'percentage' ? (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/setup/categories')}>
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={createCategoryGoal.isPending || updateCategoryGoal.isPending || hasInvalid || !categories?.length}
        >
          {createCategoryGoal.isPending || updateCategoryGoal.isPending ? 'Saving...' : 'Continue to Starting Amounts'}
        </Button>
      </div>
    </div>
  );
}
