/**
 * API Types - mirrors backend schemas
 * All monetary values use string for decimal precision
 */

// User types
export interface User {
  id: string;
  email: string;
  display_name: string;
  default_currency: string;
  timezone: string;
  created_at: string;
}

export interface UserCreate {
  email: string;
  password: string;
  display_name: string;
  default_currency?: string;
  timezone?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
}

// PayCycle types
export interface PayCycle {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  income_amount: string;
  status: 'upcoming' | 'active' | 'closed';
  rollover_amount: string;
  created_at: string;
  closed_at: string | null;
}

export interface PayCycleCreate {
  start_date: string;
  end_date: string;
  income_amount: string;
}

export interface PayCycleUpdate {
  income_amount?: string;
  start_date?: string;
  end_date?: string;
}

export interface PayCycleSummary {
  id: string;
  pay_cycle_id: string;
  total_income: string;
  total_expenses: string;
  total_savings: string;
  net_balance: string;
  category_breakdown: Record<string, CategoryBreakdown>;
  goal_completion: Record<string, GoalCompletion>;
  variances: Record<string, Variance>;
  rollover_generated: string;
  generated_at: string;
}

export interface CategoryBreakdown {
  name: string;
  spent: string;
  budget: string;
  percentage: number;
}

export interface GoalCompletion {
  goal_type: 'percentage' | 'fixed';
  goal_value: string;
  spent: string;
  completion_percentage: number;
  met: boolean;
}

export interface Variance {
  planned: string;
  actual: string;
  variance: string;
  variance_percentage: number;
}

// Category types
export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  is_shared: boolean;
  created_at: string;
}

export interface CategoryCreate {
  name: string;
  icon?: string;
  color?: string;
  is_shared?: boolean;
}

export interface CategoryUpdate {
  name?: string;
  icon?: string;
  color?: string;
  is_shared?: boolean;
}

// CategoryGoal types
export interface CategoryGoal {
  id: string;
  category_id: string;
  pay_cycle_id: string;
  goal_type: 'percentage' | 'fixed';
  goal_value: string;
  rollover_balance: string;
  created_at: string;
}

export interface CategoryGoalCreate {
  category_id: string;
  pay_cycle_id: string;
  goal_type: 'percentage' | 'fixed';
  goal_value: string;
}

export interface CategoryGoalUpdate {
  goal_type?: 'percentage' | 'fixed';
  goal_value?: string;
}

// Transaction types
export interface Transaction {
  id: string;
  user_id: string;
  pay_cycle_id: string;
  category_id: string;
  recurring_transaction_id: string | null;
  amount: string;
  description: string | null;
  transaction_date: string;
  type: 'expense' | 'income';
  is_recurring_instance: boolean;
  created_at: string;
}

export interface TransactionCreate {
  pay_cycle_id: string;
  category_id: string;
  amount: string;
  description?: string;
  transaction_date: string;
  type: 'expense' | 'income';
}

export interface TransactionUpdate {
  category_id?: string;
  amount?: string;
  description?: string;
  transaction_date?: string;
  type?: 'expense' | 'income';
}

// RecurringTransaction types
export interface RecurringTransaction {
  id: string;
  user_id: string;
  category_id: string;
  amount: string;
  description: string | null;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  type: 'expense' | 'income';
  created_at: string;
}

export interface RecurringTransactionCreate {
  category_id: string;
  amount: string;
  description?: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  day_of_week?: number;
  day_of_month?: number;
  start_date: string;
  end_date?: string;
  type: 'expense' | 'income';
}

export interface RecurringTransactionUpdate {
  amount?: string;
  description?: string;
  frequency?: 'weekly' | 'biweekly' | 'monthly';
  day_of_week?: number;
  day_of_month?: number;
  end_date?: string;
  is_active?: boolean;
}

// LongTermGoal types
export interface LongTermGoal {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_amount: string;
  current_amount: string;
  target_date: string | null;
  is_completed: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface LongTermGoalCreate {
  name: string;
  description?: string;
  target_amount: string;
  target_date?: string;
}

export interface LongTermGoalUpdate {
  name?: string;
  description?: string;
  target_amount?: string;
  current_amount?: string;
  target_date?: string;
  is_completed?: boolean;
}

// Friendship types
export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  accepted_at: string | null;
}

export interface FriendRequest {
  addressee_email: string;
}

// Social types (privacy-restricted)
export interface SharedCategoryProgress {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  category_color: string | null;
  completion_percentage: number;
  goal_type: 'percentage' | 'fixed';
  is_on_track: boolean;
  is_over_budget: boolean;
}

export interface FriendProgress {
  friend_id: string;
  friend_display_name: string;
  pay_cycle_start: string;
  pay_cycle_end: string;
  pay_cycle_status: string;
  shared_categories: SharedCategoryProgress[];
  overall_budget_used_percentage: number;
  categories_on_track: number;
  categories_over_budget: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  budget_adherence_score: number;
  goals_met_percentage: number;
  current_streak: number;
}

// Gamification types
export interface UserStats {
  current_streak: number;
  longest_streak: number;
  total_goals_met: number;
  badges: Badge[];
  level: number;
  experience_points: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
  earned_at: string;
}

// Nudge types
export interface Nudge {
  id: string;
  type: 'warning' | 'celebration' | 'tip';
  category_id?: string;
  category_name?: string;
  message: string;
  percentage?: number;
  created_at: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}
