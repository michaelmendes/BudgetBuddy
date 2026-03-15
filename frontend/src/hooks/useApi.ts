import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  PayCycle,
  PayCycleCreate,
  PayCycleUpdate,
  PayCycleCloseRequest,
  PayCycleSummary,
  PayCycleCategoryBalance,
  Category,
  CategoryCreate,
  CategoryUpdate,
  CategoryGoal,
  CategoryGoalCreate,
  CategoryGoalUpdate,
  Transaction,
  TransactionCreate,
  TransactionBatchCreate,
  TransactionUpdate,
  RecurringTransaction,
  RecurringTransactionCreate,
  RecurringTransactionUpdate,
  LongTermGoal,
  LongTermGoalCreate,
  LongTermGoalUpdate,
  Friendship,
  FriendProgress,
  LeaderboardEntry,
  DashboardData,
  UserStats,
  StartingAmountSaveRequest,
} from '@/types/api';

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
  });
}

// PayCycle hooks
export function usePayCycles() {
  return useQuery({
    queryKey: ['payCycles'],
    queryFn: () => api.getPayCycles(),
  });
}

export function useActivePayCycle() {
  return useQuery({
    queryKey: ['payCycle', 'active'],
    queryFn: () => api.getActivePayCycle(),
  });
}

export function usePayCycle(id: string | undefined) {
  return useQuery({
    queryKey: ['payCycle', id],
    queryFn: () => api.getPayCycle(id!),
    enabled: !!id,
  });
}

export function usePayCycleSummary(id: string | undefined) {
  return useQuery({
    queryKey: ['payCycleSummary', id],
    queryFn: () => api.getPayCycleSummary(id!),
    enabled: !!id,
  });
}

export function usePayCycleCategoryBalances(id: string | undefined) {
  return useQuery<PayCycleCategoryBalance[]>({
    queryKey: ['payCycleCategoryBalances', id],
    queryFn: () => api.getPayCycleCategoryBalances(id!),
    enabled: !!id,
  });
}

export function useCreatePayCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PayCycleCreate) => api.createPayCycle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payCycles'] });
      queryClient.invalidateQueries({ queryKey: ['payCycle', 'active'] });
    },
  });
}

export function useUpdatePayCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PayCycleUpdate }) =>
      api.updatePayCycle(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payCycles'] });
      queryClient.invalidateQueries({ queryKey: ['payCycle', id] });
      queryClient.invalidateQueries({ queryKey: ['payCycle', 'active'] });
    },
  });
}

export function useClosePayCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: PayCycleCloseRequest }) => api.closePayCycle(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['payCycles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payCycleOverview'] });
      queryClient.invalidateQueries({ queryKey: ['payCycle', id] });
      queryClient.invalidateQueries({ queryKey: ['payCycle', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['payCycleSummary', id] });
      queryClient.invalidateQueries({ queryKey: ['payCycleCategoryBalances', id] });
      queryClient.invalidateQueries({ queryKey: ['categoryGoals'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactionTotals'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTotals'] });
    },
  });
}

// Category hooks
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryCreate) => api.createCategory(data),
    onSuccess: (createdCategory) => {
      queryClient.setQueryData<Category[] | undefined>(['categories'], (current) => {
        if (!current) return [createdCategory];
        if (current.some((category) => category.id === createdCategory.id)) return current;
        return [...current, createdCategory];
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['categoryGoals'] });
      queryClient.invalidateQueries({ queryKey: ['startingAmounts'] });
      queryClient.invalidateQueries({ queryKey: ['payCycleCategoryBalances'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryUpdate }) =>
      api.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['categoryGoals'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// CategoryGoal hooks
export function useCategoryGoals(payCycleId: string | undefined) {
  return useQuery({
    queryKey: ['categoryGoals', payCycleId],
    queryFn: () => api.getCategoryGoals(payCycleId),
  });
}

export function useCreateCategoryGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryGoalCreate) => api.createCategoryGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['categoryGoals'] });
    },
  });
}

export function useUpdateCategoryGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryGoalUpdate }) =>
      api.updateCategoryGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['categoryGoals'] });
    },
  });
}

// Transaction hooks
export function useTransactions(payCycleId: string | undefined, categoryId?: string, type?: string) {
  return useQuery({
    queryKey: ['transactions', payCycleId, categoryId, type],
    queryFn: () => api.getTransactions(payCycleId!, categoryId, type),
    enabled: !!payCycleId,
  });
}

export function useCategoryTotals(payCycleId: string | undefined) {
  return useQuery({
    queryKey: ['categoryTotals', payCycleId],
    queryFn: () => api.getCategoryTotals(payCycleId!),
    enabled: !!payCycleId,
  });
}

export function useTransactionTotals(payCycleId: string | undefined) {
  return useQuery({
    queryKey: ['transactionTotals', payCycleId],
    queryFn: () => api.getTransactionTotals(payCycleId!),
    enabled: !!payCycleId,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TransactionCreate) => api.createTransaction(data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payCycleOverview'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', data.pay_cycle_id] });
      queryClient.invalidateQueries({ queryKey: ['categoryTotals', data.pay_cycle_id] });
      queryClient.invalidateQueries({ queryKey: ['transactionTotals', data.pay_cycle_id] });
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
    },
  });
}

export function useCreateTransactionsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TransactionBatchCreate) => api.createTransactionsBatch(data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payCycleOverview'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', data.pay_cycle_id] });
      queryClient.invalidateQueries({ queryKey: ['categoryTotals', data.pay_cycle_id] });
      queryClient.invalidateQueries({ queryKey: ['transactionTotals', data.pay_cycle_id] });
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionUpdate }) =>
      api.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payCycleOverview'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTotals'] });
      queryClient.invalidateQueries({ queryKey: ['transactionTotals'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['payCycleOverview'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryTotals'] });
      queryClient.invalidateQueries({ queryKey: ['transactionTotals'] });
    },
  });
}

// Recurring Transaction hooks
export function useRecurringTransactions() {
  return useQuery({
    queryKey: ['recurringTransactions'],
    queryFn: () => api.getRecurringTransactions(),
  });
}

export function useCreateRecurringTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecurringTransactionCreate) => api.createRecurringTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
    },
  });
}

export function useUpdateRecurringTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecurringTransactionUpdate }) =>
      api.updateRecurringTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
    },
  });
}

export function useDeleteRecurringTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRecurringTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
    },
  });
}

// Long Term Goal hooks
export function useLongTermGoals() {
  return useQuery({
    queryKey: ['longTermGoals'],
    queryFn: () => api.getLongTermGoals(),
  });
}

export function useCreateLongTermGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LongTermGoalCreate) => api.createLongTermGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['longTermGoals'] });
    },
  });
}

export function useUpdateLongTermGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: LongTermGoalUpdate }) =>
      api.updateLongTermGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['longTermGoals'] });
    },
  });
}

export function useContributeToLongTermGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) =>
      api.contributToLongTermGoal(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['longTermGoals'] });
    },
  });
}

export function useDeleteLongTermGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteLongTermGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['longTermGoals'] });
    },
  });
}

// Friend hooks
export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => api.getFriends(),
  });
}

export function usePendingFriendRequests() {
  return useQuery({
    queryKey: ['friendRequests', 'pending'],
    queryFn: () => api.getPendingRequests(),
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.sendFriendRequest(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRespondToFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api.respondToFriendRequest(id, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeFriend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });
}

// Social hooks (privacy-restricted)
export function useFriendProgress() {
  return useQuery({
    queryKey: ['social', 'friendProgress'],
    queryFn: () => api.getFriendProgress(),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['social', 'leaderboard'],
    queryFn: () => api.getLeaderboard(),
  });
}

// Gamification hooks
export function useUserStats() {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: () => api.getUserStats(),
  });
}

export function useNudges() {
  return useQuery({
    queryKey: ['nudges'],
    queryFn: () => api.getNudges(),
    refetchInterval: 60000, // Refresh every minute
  });
}

// Setup wizard hooks
export function useStartingAmounts() {
  return useQuery({
    queryKey: ['startingAmounts'],
    queryFn: () => api.getStartingAmounts(),
  });
}

export function useSaveStartingAmounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StartingAmountSaveRequest) => api.saveStartingAmounts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['startingAmounts'] });
    },
  });
}

export function useCompleteSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.completeSetup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}
