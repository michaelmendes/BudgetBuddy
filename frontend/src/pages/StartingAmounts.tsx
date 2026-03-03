import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { isValidDecimal } from '@/lib/decimal';
import {
  useCategories,
  useCompleteSetup,
  useSaveStartingAmounts,
  useStartingAmounts,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

export default function StartingAmountsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshUser } = useAuth();

  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: savedAmounts, isLoading: amountsLoading } = useStartingAmounts();
  const saveStartingAmounts = useSaveStartingAmounts();
  const completeSetup = useCompleteSetup();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!categories) return;
    const byCategory = new Map((savedAmounts ?? []).map((item) => [item.category_id, item.amount]));
    const initial: Record<string, string> = {};
    for (const category of categories) {
      initial[category.id] = byCategory.get(category.id) ?? '0.00';
    }
    setAmounts(initial);
  }, [categories, savedAmounts]);

  const hasInvalid = useMemo(
    () => Object.values(amounts).some((value) => !isValidDecimal(value)),
    [amounts]
  );

  const handleFinish = async () => {
    if (!categories?.length) {
      toast({
        title: 'No categories',
        description: 'Add categories before setting starting amounts.',
        variant: 'destructive',
      });
      return;
    }
    if (hasInvalid) {
      toast({
        title: 'Invalid amount',
        description: 'Please fix invalid amount fields before continuing.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await saveStartingAmounts.mutateAsync({
        items: categories.map((category) => ({
          category_id: category.id,
          amount: amounts[category.id] || '0.00',
        })),
      });
      await completeSetup.mutateAsync();
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save starting amounts',
        variant: 'destructive',
      });
    }
  };

  if (categoriesLoading || amountsLoading) {
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
          <CardTitle>Setup: Starting Amounts</CardTitle>
          <CardDescription>
            Step 3 of 3. Set the starting amount for each category. These are used as initial balances for your first pay cycle.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          {!categories?.length ? (
            <p className="text-sm text-muted-foreground">No categories found. Go back and add categories first.</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_160px]">
                <div className="flex items-center gap-2">
                  <span>{category.icon || '📁'}</span>
                  <span className="font-medium">{category.name}</span>
                </div>
                <Input
                  value={amounts[category.id] ?? '0.00'}
                  onChange={(event) =>
                    setAmounts((prev) => ({
                      ...prev,
                      [category.id]: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/setup/goal-amounts')}>
          Back
        </Button>
        <Button
          onClick={handleFinish}
          disabled={saveStartingAmounts.isPending || completeSetup.isPending || hasInvalid || !categories?.length}
        >
          {saveStartingAmounts.isPending || completeSetup.isPending ? 'Saving...' : 'Finish Setup'}
        </Button>
      </div>
    </div>
  );
}
