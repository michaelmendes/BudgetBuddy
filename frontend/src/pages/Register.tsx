import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/* -------------------- */
/* Validation Schema    */
/* -------------------- */

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  display_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

/* -------------------- */
/* Error Parsing Helper */
/* -------------------- */

function extractErrorMessage(error: unknown): {
  message: string;
  statusCode?: number;
} {
  console.group('🔎 Extracting Error Details');
  console.error('Raw error:', error);

  // Axios-style error
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const axiosError = error as any;

    const statusCode = axiosError.response?.status;
    const data = axiosError.response?.data;

    console.error('Detected Axios-style error');
    console.error('Status Code:', statusCode);
    console.error('Response Data:', data);

    const message =
      data?.message ||
      data?.detail ||
      (typeof data === 'string' ? data : undefined) ||
      'Server error occurred.';

    console.groupEnd();
    return { message, statusCode };
  }

  // Standard JS Error
  if (error instanceof Error) {
    console.error('Detected standard Error instance');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);

    console.groupEnd();
    return { message: error.message };
  }

  // Likely network failure (fetch)
  if (error instanceof TypeError) {
    console.error('Likely network or CORS error.');
    console.groupEnd();
    return { message: 'Unable to reach the server. Please check your connection.' };
  }

  // Fallback
  console.error('Unknown error structure.');
  console.groupEnd();
  return { message: 'An unexpected error occurred.' };
}

/* -------------------- */
/* Component            */
/* -------------------- */

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      display_name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: RegisterFormValues) {
    console.group('🚀 Register Attempt');

    console.log('Submitting form with values:', {
      ...data,
      password: '***',
      confirmPassword: '***',
    });

    setIsLoading(true);

    try {
      console.log('Calling AuthContext.register()...');

      const result = await register({
        username: data.username,
        email: data.email,
        password: data.password,
        display_name: data.display_name,
      });

      console.log('✅ Registration succeeded:', result);

      toast({
        title: 'Welcome aboard! 🎉',
        description: 'Your account has been created successfully.',
      });

      console.log('Navigating to /setup/categories...');
      navigate('/setup/categories', { replace: true });
      console.log('Navigation triggered successfully.');
    } catch (error: unknown) {
      console.error('❌ Registration failed.');

      const { message, statusCode } = extractErrorMessage(error);

      console.error('Final parsed error message:', message);
      if (statusCode) {
        console.error('HTTP Status Code:', statusCode);
      }

      toast({
        title: 'Registration failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      console.log('Register attempt complete.');
      console.groupEnd();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Start your journey to better financial habits
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(
                onSubmit,
                (errors) => {
                  console.group('❌ Validation Failed');
                  console.error('Validation errors:', errors);
                  console.groupEnd();
                }
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your username"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your name"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create account
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
