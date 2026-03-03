import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCategories, useCreateCategory, useDeleteCategory } from '@/hooks/useApi';

const DEFAULT_ICONS = ['🍕', '🚗', '🎬', '💡', '🛒', '💊', '💰', '📁', '🏠', '✈️', '👕', '🎁', '📱', '🎮', '📚', '🏋️'];

export default function SetupCategoriesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_ICONS[0]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await createCategory.mutateAsync({
        name: name.trim(),
        icon,
        color: 'category-other',
        is_shared: false,
      });
      setName('');
      setIcon(DEFAULT_ICONS[0]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add category',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete category',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Setup: Categories</CardTitle>
          <CardDescription>Step 1 of 3. Add the spending and saving categories you want to track.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Category name (e.g., Groceries)"
            />
            <Button onClick={handleAdd} disabled={createCategory.isPending || !name.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_ICONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setIcon(value)}
                className={`rounded-md border px-2 py-1 text-lg ${icon === value ? 'border-primary bg-primary/10' : ''}`}
              >
                {value}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !categories?.length ? (
            <p className="text-sm text-muted-foreground">Add at least one category to continue.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <span>{category.icon || '📁'}</span>
                    <span className="font-medium">{category.name}</span>
                  </div>
                  {!category.is_default && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => navigate('/setup/goal-amounts')} disabled={!categories?.length}>
          Continue to Goal Amounts
        </Button>
      </div>
    </div>
  );
}
