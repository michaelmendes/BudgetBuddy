import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Users,
  Trophy,
  TrendingUp,
  Flame,
  UserPlus,
  Check,
  X,
  UserMinus,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressRing } from '@/components/ProgressRing';
import { cn } from '@/lib/utils';
import { formatPercentage } from '@/lib/decimal';
import {
  useFriends,
  usePendingFriendRequests,
  useFriendProgress,
  useLeaderboard,
  useSendFriendRequest,
  useRespondToFriendRequest,
  useRemoveFriend,
} from '@/hooks/useApi';
import { useToast } from '@/hooks/use-toast';

// Mock data for demo
const mockFriendProgress = [
  {
    friend_id: '1',
    friend_display_name: 'Alex',
    pay_cycle_start: '2024-01-01',
    pay_cycle_end: '2024-01-15',
    pay_cycle_status: 'active',
    shared_categories: [
      { category_id: '1', category_name: 'Groceries', category_icon: '🛒', category_color: null, completion_percentage: 65, goal_type: 'fixed' as const, is_on_track: true, is_over_budget: false },
      { category_id: '2', category_name: 'Entertainment', category_icon: '🎬', category_color: null, completion_percentage: 45, goal_type: 'percentage' as const, is_on_track: true, is_over_budget: false },
    ],
    overall_budget_used_percentage: 58,
    categories_on_track: 4,
    categories_over_budget: 0,
  },
  {
    friend_id: '2',
    friend_display_name: 'Jordan',
    pay_cycle_start: '2024-01-01',
    pay_cycle_end: '2024-01-15',
    pay_cycle_status: 'active',
    shared_categories: [
      { category_id: '1', category_name: 'Dining Out', category_icon: '🍕', category_color: null, completion_percentage: 85, goal_type: 'fixed' as const, is_on_track: false, is_over_budget: false },
      { category_id: '2', category_name: 'Transport', category_icon: '🚗', category_color: null, completion_percentage: 30, goal_type: 'fixed' as const, is_on_track: true, is_over_budget: false },
    ],
    overall_budget_used_percentage: 72,
    categories_on_track: 3,
    categories_over_budget: 1,
  },
];

const mockLeaderboard = [
  { rank: 1, user_id: '1', display_name: 'Alex', budget_adherence_score: 95, goals_met_percentage: 100, current_streak: 21 },
  { rank: 2, user_id: 'me', display_name: 'You', budget_adherence_score: 88, goals_met_percentage: 85, current_streak: 14 },
  { rank: 3, user_id: '2', display_name: 'Jordan', budget_adherence_score: 82, goals_met_percentage: 75, current_streak: 7 },
];

const friendRequestSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type FriendRequestFormValues = z.infer<typeof friendRequestSchema>;

export default function SocialPage() {
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: friends } = useFriends();
  const { data: pendingRequests } = usePendingFriendRequests();
  const sendFriendRequest = useSendFriendRequest();
  const respondToRequest = useRespondToFriendRequest();
  const removeFriend = useRemoveFriend();

  const form = useForm<FriendRequestFormValues>({
    resolver: zodResolver(friendRequestSchema),
    defaultValues: { email: '' },
  });

  const handleSendRequest = async (values: FriendRequestFormValues) => {
    try {
      await sendFriendRequest.mutateAsync(values.email);
      toast({ title: 'Friend request sent!' });
      setIsAddFriendOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not send request',
        variant: 'destructive',
      });
    }
  };

  const handleRespondToRequest = async (id: string, accept: boolean) => {
    try {
      await respondToRequest.mutateAsync({ id, accept });
      toast({ title: accept ? 'Friend added!' : 'Request declined' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to respond',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Social</h1>
          <p className="text-muted-foreground">
            See how your friends are doing (percentages only, never amounts)
          </p>
        </div>
        <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Friend
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Friend</DialogTitle>
              <DialogDescription>
                Send a friend request by email. They can choose which categories to share.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSendRequest)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Friend's Email</FormLabel>
                      <FormControl>
                        <Input placeholder="friend@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddFriendOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sendFriendRequest.isPending}>
                    Send Request
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="font-medium">{request.requester_id}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRespondToRequest(request.id, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleRespondToRequest(request.id, true)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feed">
            <Users className="mr-2 h-4 w-4" />
            Friend Feed
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Trophy className="mr-2 h-4 w-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          {mockFriendProgress.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No friends yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-1">
                  Add friends to see their budget progress and stay motivated together.
                </p>
              </CardContent>
            </Card>
          ) : (
            mockFriendProgress.map((friend) => (
              <Card key={friend.friend_id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {friend.friend_display_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{friend.friend_display_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {friend.categories_on_track} on track
                          {friend.categories_over_budget > 0 && (
                            <span className="text-warning ml-2">
                              • {friend.categories_over_budget} over budget
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <ProgressRing
                      value={friend.overall_budget_used_percentage}
                      size="md"
                      label="used"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {friend.shared_categories.map((cat) => (
                      <div
                        key={cat.category_id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-3',
                          cat.is_over_budget && 'border-destructive/30 bg-destructive/5',
                          cat.is_on_track && !cat.is_over_budget && 'border-success/30 bg-success/5'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.category_icon}</span>
                          <span className="font-medium text-sm">{cat.category_name}</span>
                        </div>
                        <Badge
                          variant={
                            cat.is_over_budget
                              ? 'destructive'
                              : cat.completion_percentage > 80
                              ? 'secondary'
                              : 'default'
                          }
                        >
                          {formatPercentage(cat.completion_percentage)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle>This Cycle's Leaderboard</CardTitle>
              <CardDescription>Based on budget adherence and goals met</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockLeaderboard.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-4',
                      entry.user_id === 'me' && 'bg-primary/5 border-primary/30'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full font-bold',
                          entry.rank === 1 && 'bg-badge-gold text-white',
                          entry.rank === 2 && 'bg-badge-silver text-white',
                          entry.rank === 3 && 'bg-badge-bronze text-white',
                          entry.rank > 3 && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {entry.rank}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {entry.display_name}
                          {entry.user_id === 'me' && (
                            <Badge variant="outline" className="ml-2">
                              You
                            </Badge>
                          )}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {formatPercentage(entry.budget_adherence_score)} adherence
                          </span>
                          <span className="flex items-center gap-1">
                            <Flame className="h-3 w-3 text-streak" />
                            {entry.current_streak} day streak
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        {formatPercentage(entry.goals_met_percentage)}
                      </p>
                      <p className="text-xs text-muted-foreground">goals met</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
