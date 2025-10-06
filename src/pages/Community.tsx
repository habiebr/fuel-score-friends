import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { Button } from '@/components/ui/button';
import { Trophy, MapPin, Activity as ActivityIcon, Target, Users, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  location: string;
  total_miles: number;
  weekly_miles: number;
  nutrition_score: number;
  rank: number;
  composite_score: number;
  email?: string;
}

export default function Community() {
  const { user } = useAuth();
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
      // Get ALL users from profiles (which links to auth.users via user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name');

      if (profilesError) {
        console.error('❌ Error loading profiles:', profilesError);
        setLeaderboard([]); // Set empty to show "No users found" message
        setLoading(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        console.log('⚠️ No profiles found in database - users may need to complete onboarding');
        setLeaderboard([]); // Set empty to show "No users found" message
        setLoading(false);
        return;
      }

      console.log(`Found ${profiles.length} total profiles in database`);
      
      // Note: We can't use admin.listUsers() in client-side code
      // Instead, we'll use full_name from profiles or show "Anonymous Runner"
      console.log('Using profile data for display names (no admin access)');

      // Get nutrition scores for the past 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: scores, error: scoresError } = await supabase
        .from('nutrition_scores')
        .select('user_id, daily_score, date')
        .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

      if (scoresError) {
        console.error('Error loading nutrition scores:', scoresError);
      }
      console.log(`Found ${scores?.length || 0} nutrition score entries`);

      // Get Google Fit data for weekly miles
      const { data: fitData, error: fitError } = await (supabase as any)
        .from('google_fit_data')
        .select('user_id, distance_meters, date')
        .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

      if (fitError) {
        console.error('Error loading Google Fit data:', fitError);
      }
      console.log(`Found ${fitData?.length || 0} Google Fit data entries`);

      // Also fetch longer-range data for total miles (past 365 days)
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const { data: fitYear, error: fitYearErr } = await (supabase as any)
        .from('google_fit_data')
        .select('user_id, distance_meters, date')
        .gte('date', oneYearAgo.toISOString().split('T')[0]);
      if (fitYearErr) {
        console.error('Error loading yearly Google Fit data:', fitYearErr);
      }

      // Calculate stats per user - include ALL users even with no data
      const userStats = profiles.map(profile => {
        // Use user_id for matching scores/fit data (not profile.id)
        const userId = profile.user_id || profile.id;
        
        const userScores = scores?.filter(s => s.user_id === userId) || [];
        const avgScore = userScores.length > 0
          ? Math.round(userScores.reduce((sum, s) => sum + s.daily_score, 0) / userScores.length)
          : 0;

        const fitDataArr = (fitData as any[]) || [];
        const userFitData = fitDataArr.filter(f => f.user_id === userId);
        const weeklyMeters = userFitData.reduce((sum, f) => sum + (f.distance_meters || 0), 0);
        const weeklyMiles = Math.round(weeklyMeters / 1609.34);
        const fitYearArr = (fitYear as any[]) || [];
        const userFitYear = fitYearArr.filter(f => f.user_id === userId);
        const yearMeters = userFitYear.reduce((sum, f) => sum + (f.distance_meters || 0), 0);
        const totalMiles = Math.round(yearMeters / 1609.34); // cumulative miles over last year

        // Generate display name: use full_name or show as "Anonymous Runner"
        const displayName = profile.full_name || `Runner ${userId.substring(0, 4)}`;

        return {
          user_id: userId,
          full_name: displayName,
          location: 'New York, NY', // Placeholder: should be from profile
          total_miles: totalMiles,
          weekly_miles: weeklyMiles,
          nutrition_score: avgScore,
          rank: 0,
          composite_score: 0 // Will calculate next
        };
      });

      console.log(`Processed ${userStats.length} user stats`);

      // Calculate composite score (60% nutrition, 40% miles-based)
      // Normalize both metrics to 0-100 scale
      const maxMiles = Math.max(...userStats.map(u => u.total_miles), 1);
      userStats.forEach(entry => {
        const normalizedMiles = (entry.total_miles / maxMiles) * 100;
        const normalizedNutrition = entry.nutrition_score;
        
        // Composite score: 60% nutrition (more important) + 40% miles
        // If both are 0, give a small base score to show in leaderboard
        entry.composite_score = (normalizedNutrition * 0.6) + (normalizedMiles * 0.4);
      });

      // Sort by composite score (both nutrition and miles) and assign ranks
      userStats.sort((a, b) => {
        // Sort by composite score descending
        if (b.composite_score !== a.composite_score) {
          return b.composite_score - a.composite_score;
        }
        // If tied, sort by nutrition score
        if (b.nutrition_score !== a.nutrition_score) {
          return b.nutrition_score - a.nutrition_score;
        }
        // If still tied, sort by miles
        return b.total_miles - a.total_miles;
      });
      
      userStats.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      console.log(`✅ Processed ${userStats.length} users for leaderboard`);
      console.log('Top 5 users:', userStats.slice(0, 5).map(u => ({
        name: u.full_name,
        user_id: u.user_id.substring(0, 8),
        score: u.nutrition_score,
        miles: u.total_miles,
        composite: u.composite_score.toFixed(2)
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
        <div className="w-full mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center flex-shrink-0">
                <ActivityIcon className="w-6 h-6 text-white dark:text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">NutriSync</h1>
                <p className="text-sm text-muted-foreground">Fuel Your Run</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Beta Badge */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">BETA</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Community Features</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Connect with fellow runners and compete on our weekly leaderboard!
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <Button
                variant={activeTab === 'leaderboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('leaderboard')}
                className="flex-1"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboard
              </Button>
              <Button
                variant={activeTab === 'challenges' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('challenges')}
                className="flex-1"
              >
                <Target className="w-4 h-4 mr-2" />
                Challenges
              </Button>
              <Button
                variant={activeTab === 'groups' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('groups')}
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-2" />
                Groups
              </Button>
            </div>

            {activeTab === 'leaderboard' && (
              <>
                {/* Your Rank Card */}
                {userRank && (
                  <Card className="shadow-card">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
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
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">#{userRank.rank}</span>
                            <span className="text-2xl font-bold">#{userRank.rank}</span>
                          </div>
                          <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getScoreBadge(userRank.nutrition_score).color}`}>
                            {getScoreBadge(userRank.nutrition_score).text}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold">{userRank.total_miles}</div>
                          <div className="text-xs text-muted-foreground">Total Miles</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-500">{userRank.nutrition_score}</div>
                          <div className="text-xs text-muted-foreground">Nutrition Score</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{userRank.weekly_miles}</div>
                          <div className="text-xs text-muted-foreground">Day Streak</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Ranking Info */}
                <Card className="shadow-card">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <span className="text-blue-600">⭐</span>
                      Weekly Nutrition Score
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                      Based on meal consistency, macro balance, hydration, and pre/post-run nutrition timing over the past 7 days.
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-muted-foreground">
                        <strong>Ranking Formula:</strong> Your rank is based on both your nutrition score (60%) and total miles run (40%). 
                        Keep logging meals and running to climb the leaderboard!
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly Leaderboard */}
                <Card className="shadow-card">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      Global Leaderboard
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      All {leaderboard.length} registered NutriSync users ranked by nutrition + miles
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
                            <div className="font-semibold truncate">{entry.full_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {entry.location}
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold">{entry.total_miles} mi</div>
                            <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                              <ActivityIcon className="w-3 h-3" />
                              {entry.weekly_miles} mi this week
                            </div>
                          </div>

                          {/* Score Badge */}
                          <div className="text-right flex-shrink-0 min-w-[3rem]">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {entry.nutrition_score}
                            </div>
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
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">Challenges Coming Soon</h3>
                  <p className="text-sm text-muted-foreground">
                    Weekly nutrition and training challenges will be available soon!
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === 'groups' && (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">Groups Coming Soon</h3>
                  <p className="text-sm text-muted-foreground">
                    Join running groups and train together with your community!
                  </p>
                </CardContent>
              </Card>
            )}
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
