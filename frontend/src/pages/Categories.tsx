import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, FolderOpen, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, isValidDecimal, parseDecimal } from '@/lib/decimal';
import {
  useCategoryGoals,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';
import type { Category } from '@/types/api';

const CATEGORY_ICONS = ['🍕', '🚗', '🎬', '💡', '🛒', '💊', '💰', '📁', '🏠', '✈️', '👕', '🎁', '📱', '🎮', '📚', '🏋️'];
const CATEGORY_COLORS = [
  { name: 'Food', value: 'category-food' },
  { name: 'Transport', value: 'category-transport' },
  { name: 'Entertainment', value: 'category-entertainment' },
  { name: 'Utilities', value: 'category-utilities' },
  { name: 'Shopping', value: 'category-shopping' },
  { name: 'Health', value: 'category-health' },
  { name: 'Savings', value: 'category-savings' },
  { name: 'Other', value: 'category-other' },
];

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  icon: z.string().min(1, 'Please select an icon'),
  color: z.string().optional(),
  is_shared: z.boolean().default(false),
  allocation_type: z.enum(['percentage', 'fixed']),
  allocation_value: z
    .string()
    .min(1, 'Allocation is required')
    .refine((value) => isValidDecimal(value), 'Please enter a valid amount')
    .refine((value) => Number(value) >= 0, 'Allocation must be 0 or greater'),
}).refine((data) => data.allocation_type !== 'percentage' || Number(data.allocation_value) <= 100, {
  path: ['allocation_value'],
  message: 'Percentage allocation cannot exceed 100',
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { toast } = useToast();
  const { data: categories, isLoading } = useCategories();
  const { data: categoryGoals } = useCategoryGoals(undefined);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      icon: '📁',
      color: 'category-other',
      is_shared: false,
      allocation_type: 'fixed',
      allocation_value: '',
    },
  });

  useEffect(() => {
    if (!isDialogOpen || !editingCategory) return;

    const goal = categoryGoals?.find((item) => item.category_id === editingCategory.id);
    if (!goal) return;

    const currentValue = form.getValues('allocation_value');
    const currentType = form.getValues('allocation_type');
    if (currentValue === '' || currentType !== goal.goal_type) {
      form.setValue('allocation_type', goal.goal_type, { shouldValidate: true });
      form.setValue('allocation_value', goal.goal_value, { shouldValidate: true });
    }
  }, [isDialogOpen, editingCategory, categoryGoals, form]);

  const handleOpenDialog = (category?: Category) => {
    const goal = category ? categoryGoals?.find((item) => item.category_id === category.id) : null;
    if (category) {
      setEditingCategory(category);
      form.reset({
        name: category.name,
        icon: category.icon || '📁',
        color: category.color || 'category-other',
        is_shared: category.is_shared,
        allocation_type: goal?.goal_type || 'fixed',
        allocation_value: goal?.goal_value || '',
      });
    } else {
      setEditingCategory(null);
      form.reset({
        name: '',
        icon: '📁',
        color: 'category-other',
        is_shared: false,
        allocation_type: 'fixed',
        allocation_value: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: CategoryFormValues) => {
    try {
      const data = {
        name: values.name,
        icon: values.icon,
        color: values.color,
        is_shared: values.is_shared,
        allocation_type: values.allocation_type,
        allocation_value: values.allocation_value,
      };

      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          data,
        });
        toast({ title: 'Category updated' });
      } else {
        await createCategory.mutateAsync(data);
        toast({ title: 'Category created' });
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

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast({ title: 'Category deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground">Organize your spending into categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Update the category details.'
                  : 'Create a new category to organize your transactions.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Groceries" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-8 gap-2">
                          {CATEGORY_ICONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => field.onChange(icon)}
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-colors',
                                field.value === icon
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border hover:border-primary/50'
                              )}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allocation_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allocation Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                          <SelectItem value="percentage">Percentage of cycle income (%)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose whether this category uses a dollar cap or a percentage of your cycle income.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allocation_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch('allocation_type') === 'percentage'
                          ? 'Allocation (%)'
                          : 'Allocation Amount ($)'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={form.watch('allocation_type') === 'percentage' ? 'e.g., 15' : 'e.g., 250.00'}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {form.watch('allocation_type') === 'percentage'
                          ? 'Enter 0 to 100.'
                          : 'Enter a fixed dollar amount for this cycle.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_shared"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Share with friends</FormLabel>
                        <FormDescription>
                          Friends can see your progress percentage (not amounts)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createCategory.isPending ||
                      updateCategory.isPending
                    }
                  >
                    {editingCategory ? 'Update' : 'Create'} Category
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : categories?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No categories yet. Create one to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories?.map((category) => (
            <Card key={category.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl" role="img" aria-label={category.name}>
                      {category.icon || '📁'}
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">{category.name}</h3>
                      {category.is_default && (
                        <div className="text-sm text-muted-foreground">Default</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenDialog(category)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!category.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(category.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {(() => {
                  const goal = categoryGoals?.find((item) => item.category_id === category.id);
                  const showAllocation = !!goal && parseDecimal(goal.goal_value) !== 0;
                  if (!showAllocation && !category.is_shared) return null;

                  const allocationLabel = showAllocation && goal
                    ? goal.goal_type === 'percentage'
                      ? `${Number(goal.goal_value)}% of cycle income`
                      : `${formatCurrency(goal.goal_value)} fixed`
                    : '';

                  return (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      {showAllocation ? (
                        <span>
                          Allocation:{' '}
                          <span className="font-medium text-foreground">
                            {allocationLabel}
                          </span>
                        </span>
                      ) : (
                        <span />
                      )}

                      {category.is_shared && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Share2 className="h-3 w-3" />
                          Shared
                        </span>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
