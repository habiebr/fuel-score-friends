import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, TrendingUp, Trophy, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadCommunityData();
    }
  }, [user]);

  const loadCommunityData = async () => {
    if (!user) return;

    try {
      // Get friends list
      const { data: friendsData } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      // Get leaderboard (friends' scores)
      const { data: scoresData } = await supabase
        .from('nutrition_scores')
        .select('*')
        .order('daily_score', { ascending: false })
        .limit(10);

      setFriends(friendsData || []);
      setLeaderboard(scoresData || []);
    } catch (error) {
      console.error('Error loading community data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = () => {
    toast({
      title: "Coming soon!",
      description: "Friend requests will be available in the next update.",
    });
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-background flex items-center justify-center pb-20">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
        <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
        <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      </>
    );
  }

  return (
    <>
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-7xl mx-auto p-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Community</h1>
            <p className="text-muted-foreground text-sm">Connect with friends and track progress together</p>
          </div>

          {/* Add Friends */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Friends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={handleAddFriend}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Friends
              </Button>
              <div className="mt-4">
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No friends yet. Add friends to see their progress!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium">Friend</span>
                        </div>
                        <Button variant="ghost" size="sm">View</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No scores yet. Start logging meals to compete!
                </p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-warning text-warning-foreground' :
                          index === 1 ? 'bg-muted text-muted-foreground' :
                          index === 2 ? 'bg-info/20 text-info' :
                          'bg-background text-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-medium">
                          {entry.user_id === user?.id ? 'You' : 'User'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="font-bold text-lg">{entry.daily_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Challenges */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-secondary" />
                Weekly Challenge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
                <h3 className="font-semibold mb-2">Log 21 Meals This Week!</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Complete this challenge to earn bonus points
                </p>
                <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-secondary w-[45%] transition-all"></div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">9/21 meals logged</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
