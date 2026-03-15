import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Layouts
import AppLayout from "@/layouts/AppLayout";

// Public pages
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";

// Protected pages
import DashboardPage from "@/pages/Dashboard";
import TransactionsPage from "@/pages/Transactions";
import CategoriesPage from "@/pages/Categories";
import RecurringPage from "@/pages/Recurring";
import GoalsPage from "@/pages/Goals";
import SocialPage from "@/pages/Social";
import CycleSummaryPage from "@/pages/CycleSummary";
import NewCyclePage from "@/pages/NewCycle";
import PayCyclePage from "@/pages/PayCycle";
import PayCycleReviewPage from "@/pages/PayCycleReview";
import PayCycleClosePage from "@/pages/PayCycleClose";
import SetupCategoriesPage from "@/pages/SetupCategories";
import SetupGoalAmountsPage from "@/pages/SetupGoalAmounts";
import StartingAmountsPage from "@/pages/StartingAmounts";
import ManageAccountPage from "@/pages/ManageAccount";
import DataExportPage from "@/pages/DataExport";
import BackupDataLocalPage from "@/pages/BackupDataLocal";

import NotFound from "./pages/NotFound";
import ResetPasswordPage from "./pages/ResetPassword";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes with app layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/transactions/new" element={<TransactionsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/recurring" element={<RecurringPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/social" element={<SocialPage />} />
              <Route path="/cycles" element={<PayCyclePage />} />
              <Route path="/cycles/new" element={<NewCyclePage />} />
              <Route path="/cycles/:id/close" element={<PayCycleClosePage />} />
              <Route path="/cycles/:id/review" element={<PayCycleReviewPage />} />
              <Route path="/cycles/:id/summary" element={<CycleSummaryPage />} />
              <Route path="/setup/categories" element={<SetupCategoriesPage />} />
              <Route path="/setup/goal-amounts" element={<SetupGoalAmountsPage />} />
              <Route path="/setup/starting-amounts" element={<StartingAmountsPage />} />
              <Route path="/account" element={<ManageAccountPage />} />
              <Route path="/export-data" element={<DataExportPage />} />
              <Route path="/backup-data" element={<BackupDataLocalPage />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
