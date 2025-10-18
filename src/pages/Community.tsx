import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { Button } from '@/components/ui/button';
import { Trophy, MapPin, Activity as ActivityIcon, Target, Users, Crown } from 'lucide-react';
import { getAllUsersWeeklyScoresFromCache } from '@/services/unified-score.service';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PageHeading } from '@/components/PageHeading';
import { startOfWeek, format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  location: string;
  total_kilometers: number;
  weekly_kilometers: number;
  weekly_score: number;
  rank: number;
  email?: string;
}

const formatKilometers = (value: number): string => {
  const normalized = Number.isFinite(value) ? value : 0;
  return Number.isInteger(normalized) ? normalized.toString() : normalized.toFixed(1);
};

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'challenges' | 'groups'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadGlobalLeaderboard();
    }
  }, [user]);

  const loadGlobalLeaderboard = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('🔍 Loading global leaderboard...');
      
      // Get ALL users from profiles (which links to auth.users via user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, city');

      console.log('📊 Profiles query result:', { profiles, error: profilesError });

      if (profilesError) {
        console.error('❌ Error loading profiles:', profilesError);
        toast({
          title: 'Error loading leaderboard',
          description: `Failed to load profiles: ${profilesError.message}`,
          variant: 'destructive',
        });
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        console.log('⚠️ No profiles found in database');
        toast({
          title: 'No users found',
          description: 'No profiles found in the database.',
        });
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      console.log(`Found ${profiles.length} total profiles in database`);

      // Get weekly scores from cached unified scoring system
      console.log('🔍 Fetching weekly scores from cache...');
      const weeklyScores = await getAllUsersWeeklyScoresFromCache();
      console.log(`Found ${weeklyScores.length} users with weekly scores from cache:`, weeklyScores);

      // Get Google Fit data for current week (Mon-Sun)
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

      // Weekly running totals via service-backed edge function
      const { data: weeklyRunningData, error: weeklyRunningError } = await supabase.functions.invoke('weekly-running-leaderboard', {
        body: { weekStart: weekStartStr },
      });
      if (weeklyRunningError) {
        console.error('Error loading weekly running totals:', weeklyRunningError);
      }

      // Build quick lookup map for weekly meters by user
      const weeklyByUser: Record<string, number> = {};
      const weeklyEntries = (weeklyRunningData as any)?.entries;
      if (Array.isArray(weeklyEntries)) {
        for (const entry of weeklyEntries as any[]) {
          const userId = entry?.user_id;
          const meters = Number(entry?.distance_meters) || 0;
          if (!userId) continue;
          weeklyByUser[userId] = meters;
        }
      }

      // No live per-day fetch beyond sessions; rely on aggregated session totals

      // Also fetch longer-range data for total miles (past 365 days)
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const { data: fitYear, error: fitYearErr } = await (supabase as any)
        .from('google_fit_data')
        .select('user_id, distance_meters')
        .gte('date', oneYearAgo.toISOString().split('T')[0]);
      if (fitYearErr) {
        console.error('Error loading yearly Google Fit data:', fitYearErr);
      }

      // Calculate stats per user - include ALL users even with no data
      const userStats = profiles
        .map(profile => {
        const userId = profile.user_id; // require auth user_id for joins
        if (!userId) return null;
        
        // Get weekly score from cached unified scoring system
        const userWeeklyData = weeklyScores.find(ws => ws.user_id === userId);
        const weeklyScore = userWeeklyData?.weekly_score || 0;

        // Use running session totals for current week
        const weeklyMeters = weeklyByUser[userId] || 0;
        const weeklyKilometers = Number((weeklyMeters / 1000).toFixed(1));
        const fitYearArr = (fitYear as any[]) || [];
        const userFitYear = fitYearArr.filter(f => f.user_id === userId);
        const yearMeters = userFitYear.reduce((sum, f) => {
          const dm = parseFloat(String(f.distance_meters ?? 0));
          return sum + (Number.isFinite(dm) ? dm : 0);
        }, 0);
        const totalKilometers = Number((yearMeters / 1000).toFixed(1));

        // Generate display name: use full_name or show as "Anonymous Runner"
        const displayName = profile.full_name || `Runner ${userId.substring(0, 4)}`;

        return {
          user_id: userId,
          full_name: displayName,
          location: profile.city || 'New York, NY', // Use profile full_name if available
          total_kilometers: totalKilometers,
          weekly_kilometers: weeklyKilometers,
          weekly_score: weeklyScore,
          rank: 0
        };
      }).filter(Boolean) as LeaderboardEntry[];

      console.log(`Processed ${userStats.length} user stats`);

      // Sort by weekly score (from unified scoring system) and assign ranks
      userStats.sort((a, b) => {
        // Sort by weekly score descending
        if (b.weekly_score !== a.weekly_score) {
          return b.weekly_score - a.weekly_score;
        }
        // If tied, sort by total kilometers
        return b.total_kilometers - a.total_kilometers;
      });
      
      userStats.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      console.log(`✅ Processed ${userStats.length} users for leaderboard`);
      console.log('Top 5 users (cached weekly scores):', userStats.slice(0, 5).map(u => ({
        name: u.full_name,
        user_id: u.user_id.substring(0, 8),
        weekly_score: u.weekly_score,
        kilometers: u.total_kilometers,
        weekly_km: u.weekly_kilometers
      })));

      // Find current user's rank
      const currentUserRank = userStats.find(entry => entry.user_id === user.id);
      console.log('Current user rank:', currentUserRank ? `#${currentUserRank.rank}` : 'not found');
      setUserRank(currentUserRank || null);

      // Set ALL users (not just top 20) so we can show everyone
      console.log(`📊 Setting ${userStats.length} users to leaderboard state`);
      setLeaderboard(userStats);

    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { text: 'Excellent', color: 'bg-green-500/10 text-green-700 dark:text-green-400' };
    if (score >= 80) return { text: 'Good', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' };
    if (score >= 70) return { text: 'Fair', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' };
    return { text: 'Needs Work', color: 'bg-red-500/10 text-red-700 dark:text-red-400' };
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-background flex items-center justify-center pb-20">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
        <BottomNav />
        <ActionFAB
          onLogMeal={() => setFoodTrackerOpen(true)}
          onUploadActivity={() => setFitnessScreenshotOpen(true)}
        />
        <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
        <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          <PageHeading
            title="Community"
            description="Compete with fellow runners and celebrate weekly wins"
            icon={Users}
          />

          {/* Content */}
          <div className="space-y-4">
            {/* Tabs - horizontal scroll on small screens */}
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={activeTab === 'leaderboard' ? 'default' : 'ghost'}
                  size="sm" className="px-2 sm:px-4"
                  onClick={() => setActiveTab('leaderboard')}
                >
                  <Trophy className="w-4 h-4 mr-1 sm:mr-2" />
                  Leaderboard
                </Button>
                <Button
                  variant={activeTab === 'challenges' ? 'default' : 'ghost'}
                  size="sm" className="px-2 sm:px-4"
                  onClick={() => setActiveTab('challenges')}
                >
                  <Target className="w-4 h-4 mr-1 sm:mr-2" />
                  Challenges
                </Button>
                <Button
                  variant={activeTab === 'groups' ? 'default' : 'ghost'}
                  size="sm" className="px-2 sm:px-4"
                  onClick={() => setActiveTab('groups')}
                >
                  <Users className="w-4 h-4 mr-1 sm:mr-2" />
                  Groups
                </Button>
              </div>
            </div>

            {activeTab === 'leaderboard' && (
              <>
                {/* Your Rank Card */}
                {userRank && (
                  <Card className="shadow-card w-full">
                    <CardContent className="p-3 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center font-bold text-white dark:text-black text-lg">
                            {userRank.full_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Your Rank</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {userRank.location}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-2xl font-bold">#{userRank.rank}</span>
                          </div>
                          <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getScoreBadge(userRank.weekly_score).color}`}>
                            {getScoreBadge(userRank.weekly_score).text}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 text-center">
                        <div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-2xl font-bold text-orange-500 cursor-help hover:text-orange-600 transition-colors">
                                  {userRank.weekly_score}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-[200px]">Average of daily scores (nutrition + training + bonuses - penalties) from unified scoring system over the past 7 days.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="text-xs text-muted-foreground">Weekly Score</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{formatKilometers(userRank.weekly_kilometers)}</div>
                          <div className="text-xs text-muted-foreground">Weekly km</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Ranking Info */}
                <Card className="shadow-card w-full">
                  <CardContent className="p-3 sm:p-6">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <span className="text-blue-600">⭐</span>
                      Weekly Score
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your rank is based on your weekly score, which combines nutrition and training performance. Keep logging meals and completing workouts to climb the leaderboard!
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Curious how we grade each day? <a href="/score-explainer" className="text-primary underline underline-offset-2">See the scoring explainer</a>.
                    </p>
                  </CardContent>
                </Card>

                {/* Weekly Leaderboard */}
                <Card className="shadow-card w-full">
                  <CardContent className="p-3 sm:p-6">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      Global Leaderboard
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      All {leaderboard.length} registered Nutrisync users ranked by weekly score
                    </p>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {leaderboard.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No users found. Be the first to start logging!</p>
                        </div>
                      ) : (
                        leaderboard.map((entry, index) => (
                        <div
                          key={entry.user_id}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            entry.user_id === user?.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                              : 'bg-gray-50 dark:bg-gray-800'
                          }`}
                        >
                          {/* Rank Icon */}
                          <div className="flex-shrink-0 w-8 text-center">
                            {index === 0 ? (
                              <Crown className="w-6 h-6 text-yellow-500 mx-auto" />
                            ) : (
                              <span className="text-lg font-bold text-muted-foreground">
                                {getRankBadge(entry.rank)}
                              </span>
                            )}
                          </div>

                          {/* Avatar */}
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {entry.full_name.substring(0, 2).toUpperCase()}
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">{entry.full_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {entry.location}
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="text-right flex-shrink-0 hidden sm:block">
                            <div className="font-bold whitespace-nowrap">{formatKilometers(entry.weekly_kilometers)} km</div>
                          </div>

                          {/* Score Badge */}
                          <div className="text-right flex-shrink-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 cursor-help hover:text-green-700 dark:hover:text-green-300 transition-colors">
                                    {entry.weekly_score}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[200px]">This week's average score from nutrition, training, and bonuses.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'challenges' && (
              <Card className="shadow-card w-full">
                <CardContent className="p-3 sm:p-6 text-center">
                  <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">Challenges Coming Soon</h3>
                  <p className="text-sm text-muted-foreground">
                    Weekly nutrition and training challenges will be available soon!
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === 'groups' && (
              <Card className="shadow-card w-full">
                <CardContent className="p-3 sm:p-6 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">Groups Coming Soon</h3>
                  <p className="text-sm text-muted-foreground">
                    Join running groups and train together with your community!
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Beta Badge */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 w-full">
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">BETA</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Community Features</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Connect with fellow runners and compete on our weekly leaderboard!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
      <ActionFAB
        onLogMeal={() => setFoodTrackerOpen(true)}
        onUploadActivity={() => setFitnessScreenshotOpen(true)}
      />
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
    </>
  );
}
