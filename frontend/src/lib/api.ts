/**
 * API Client for communicating with the FastAPI backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: import('@/types/api').UserCreate) {
    return this.request<import('@/types/api').User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: import('@/types/api').UserLogin) {
    return this.request<import('@/types/api').Token>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // User endpoints
  async getCurrentUser() {
    return this.request<import('@/types/api').User>('/users/me');
  }

  async updateProfile(data: Partial<import('@/types/api').User>) {
    return this.request<import('@/types/api').User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // PayCycle endpoints
  async getPayCycles() {
    return this.request<import('@/types/api').PayCycle[]>('/pay-cycles');
  }

  async getActivePayCycle() {
    return this.request<import('@/types/api').PayCycle>('/pay-cycles/active');
  }

  async getPayCycle(id: string) {
    return this.request<import('@/types/api').PayCycle>(`/pay-cycles/${id}`);
  }

  async createPayCycle(data: import('@/types/api').PayCycleCreate) {
    return this.request<import('@/types/api').PayCycle>('/pay-cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayCycle(id: string, data: import('@/types/api').PayCycleUpdate) {
    return this.request<import('@/types/api').PayCycle>(`/pay-cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async closePayCycle(id: string) {
    return this.request<import('@/types/api').PayCycleSummary>(`/pay-cycles/${id}/close`, {
      method: 'POST',
    });
  }

  async getPayCycleSummary(id: string) {
    return this.request<import('@/types/api').PayCycleSummary>(`/pay-cycles/${id}/summary`);
  }

  // Category endpoints
  async getCategories() {
    return this.request<import('@/types/api').Category[]>('/categories');
  }

  async createCategory(data: import('@/types/api').CategoryCreate) {
    return this.request<import('@/types/api').Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: import('@/types/api').CategoryUpdate) {
    return this.request<import('@/types/api').Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string) {
    return this.request<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // CategoryGoal endpoints
  async getCategoryGoals(payCycleId: string) {
    return this.request<import('@/types/api').CategoryGoal[]>(`/goals?pay_cycle_id=${payCycleId}`);
  }

  async createCategoryGoal(data: import('@/types/api').CategoryGoalCreate) {
    return this.request<import('@/types/api').CategoryGoal>('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategoryGoal(id: string, data: import('@/types/api').CategoryGoalUpdate) {
    return this.request<import('@/types/api').CategoryGoal>(`/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Transaction endpoints
  async getTransactions(payCycleId: string, categoryId?: string, type?: string) {
    let url = `/transactions?pay_cycle_id=${payCycleId}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (type) url += `&type=${type}`;
    return this.request<import('@/types/api').Transaction[]>(url);
  }

  async getTransaction(id: string) {
    return this.request<import('@/types/api').Transaction>(`/transactions/${id}`);
  }

  async createTransaction(data: import('@/types/api').TransactionCreate) {
    return this.request<import('@/types/api').Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTransaction(id: string, data: import('@/types/api').TransactionUpdate) {
    return this.request<import('@/types/api').Transaction>(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTransaction(id: string) {
    return this.request<void>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  async getCategoryTotals(payCycleId: string) {
    return this.request<Record<string, number>>(`/transactions/summary/by-category?pay_cycle_id=${payCycleId}`);
  }

  async getTransactionTotals(payCycleId: string) {
    return this.request<{ expense: number; income: number }>(`/transactions/summary/totals?pay_cycle_id=${payCycleId}`);
  }

  // RecurringTransaction endpoints
  async getRecurringTransactions() {
    return this.request<import('@/types/api').RecurringTransaction[]>('/recurring');
  }

  async createRecurringTransaction(data: import('@/types/api').RecurringTransactionCreate) {
    return this.request<import('@/types/api').RecurringTransaction>('/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRecurringTransaction(id: string, data: import('@/types/api').RecurringTransactionUpdate) {
    return this.request<import('@/types/api').RecurringTransaction>(`/recurring/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRecurringTransaction(id: string) {
    return this.request<void>(`/recurring/${id}`, {
      method: 'DELETE',
    });
  }

  // LongTermGoal endpoints
  async getLongTermGoals() {
    return this.request<import('@/types/api').LongTermGoal[]>('/goals/long-term');
  }

  async createLongTermGoal(data: import('@/types/api').LongTermGoalCreate) {
    return this.request<import('@/types/api').LongTermGoal>('/goals/long-term', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLongTermGoal(id: string, data: import('@/types/api').LongTermGoalUpdate) {
    return this.request<import('@/types/api').LongTermGoal>(`/goals/long-term/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async contributToLongTermGoal(id: string, amount: string) {
    return this.request<import('@/types/api').LongTermGoal>(`/goals/long-term/${id}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async deleteLongTermGoal(id: string) {
    return this.request<void>(`/goals/long-term/${id}`, {
      method: 'DELETE',
    });
  }

  // Friend endpoints
  async getFriends() {
    return this.request<import('@/types/api').Friendship[]>('/friends');
  }

  async getPendingRequests() {
    return this.request<import('@/types/api').Friendship[]>('/friends/pending');
  }

  async sendFriendRequest(email: string) {
    return this.request<import('@/types/api').Friendship>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ addressee_email: email }),
    });
  }

  async respondToFriendRequest(id: string, accept: boolean) {
    return this.request<import('@/types/api').Friendship>(`/friends/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  }

  async removeFriend(id: string) {
    return this.request<void>(`/friends/${id}`, {
      method: 'DELETE',
    });
  }

  // Social endpoints (privacy-restricted)
  async getFriendProgress() {
    return this.request<import('@/types/api').FriendProgress[]>('/social/friends/progress');
  }

  async getLeaderboard() {
    return this.request<import('@/types/api').LeaderboardEntry[]>('/social/leaderboard');
  }

  // Gamification endpoints
  async getUserStats() {
    return this.request<import('@/types/api').UserStats>('/users/me/stats');
  }

  async getNudges() {
    return this.request<import('@/types/api').Nudge[]>('/users/me/nudges');
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
