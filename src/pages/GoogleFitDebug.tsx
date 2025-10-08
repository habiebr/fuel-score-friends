import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Activity, Calendar, TrendingUp, Clock, MapPin, Heart, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

interface GoogleFitSession {
  id: string;
  session_id: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  name: string;
  description: string;
  raw: any;
}

interface GoogleFitData {
  id: string;
  date: string;
  steps: number;
  calories_burned: number;
  active_minutes: number;
  distance_meters: number;
  heart_rate_avg: number | null;
  sessions: GoogleFitSession[];
  last_synced_at: string;
}

interface ActivityStats {
  totalSessions: number;
  totalDistance: number;
  totalCalories: number;
  totalActiveMinutes: number;
  averageHeartRate: number;
  mostCommonActivity: string;
  longestSession: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function GoogleFitDebug() {
  const { user, getGoogleAccessToken } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState<GoogleFitData[]>([]);
  const [sessions, setSessions] = useState<GoogleFitSession[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [days, setDays] = useState(30);

  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Load daily data
      const { data: dailyData, error: dailyError } = await supabase
        .from('google_fit_data')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(subDays(new Date(), days), 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (dailyError) throw dailyError;

      // Load sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('google_fit_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', subDays(new Date(), days).toISOString())
        .order('start_time', { ascending: false });

      if (sessionsError) throw sessionsError;

      setData(dailyData || []);
      setSessions(sessionsData || []);

      // Calculate stats
      if (sessionsData && sessionsData.length > 0) {
        const totalSessions = sessionsData.length;
        const totalDistance = (dailyData || []).reduce((sum, d) => sum + (d.distance_meters || 0), 0);
        const totalCalories = (dailyData || []).reduce((sum, d) => sum + (d.calories_burned || 0), 0);
        const totalActiveMinutes = (dailyData || []).reduce((sum, d) => sum + (d.active_minutes || 0), 0);
        
        const heartRates = (dailyData || []).filter(d => d.heart_rate_avg).map(d => d.heart_rate_avg!);
        const averageHeartRate = heartRates.length > 0 ? heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length : 0;

        const activityCounts: Record<string, number> = {};
        sessionsData.forEach(session => {
          const activity = session.activity_type.toLowerCase();
          activityCounts[activity] = (activityCounts[activity] || 0) + 1;
        });
        const mostCommonActivity = Object.entries(activityCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];

        const sessionDurations = sessionsData.map(session => {
          const start = new Date(session.start_time);
          const end = new Date(session.end_time);
          return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
        });
        const longestSession = Math.max(...sessionDurations);

        setStats({
          totalSessions,
          totalDistance: Math.round(totalDistance / 1000 * 100) / 100, // Convert to km
          totalCalories: Math.round(totalCalories),
          totalActiveMinutes,
          averageHeartRate: Math.round(averageHeartRate),
          mostCommonActivity,
          longestSession: Math.round(longestSession)
        });
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load Google Fit data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncAllData = async () => {
    if (!user) return;

    setIsSyncing(true);
    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        throw new Error('No Google Fit access token available');
      }

      // Get the current session to include authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      const { data, error } = await supabase.functions.invoke('sync-all-google-fit-data', {
        body: { 
          accessToken,
          days: days
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast({
        title: "Sync successful!",
        description: data.message || "Data synced successfully",
      });

      // Reload data after sync
      await loadData();

    } catch (error) {
      console.error('Error syncing data:', error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Failed to sync Google Fit data",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const manualSync = async () => {
    if (!user) return;

    setIsSyncing(true);
    try {
      console.log('Starting manual sync process...');
      
      // Force refresh the token first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      console.log('Session found, refreshing token...');

      // Call the refresh token function first
      const { data: refreshData, error: refreshError } = await supabase.functions.invoke('refresh-google-fit-token-v2', {
        body: {
          user_id: user.id,
          force_refresh: true
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (refreshError) {
        console.warn('Token refresh failed, proceeding with existing token:', refreshError);
        toast({
          title: "Token refresh warning",
          description: "Could not refresh token, using existing one",
          variant: "destructive",
        });
      } else {
        console.log('Token refreshed successfully:', refreshData);
      }

      // Now sync with the refreshed token
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        throw new Error('No Google Fit access token available');
      }

      console.log('Starting manual sync with token:', accessToken.substring(0, 20) + '...');

      const { data, error } = await supabase.functions.invoke('sync-all-google-fit-data', {
        body: { 
          accessToken,
          days: 7 // Sync last 7 days for manual sync
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log('Sync response:', { data, error });

      if (error) {
        console.error('Sync function error:', error);
        throw new Error(`Sync failed: ${error.message || 'Unknown error'}`);
      }

      toast({
        title: "Manual sync successful!",
        description: data?.message || "Data synced successfully",
      });

      // Reload data after sync
      await loadData();

    } catch (error) {
      console.error('Error in manual sync:', error);
      toast({
        title: "Manual sync failed",
        description: error instanceof Error ? error.message : "Failed to sync Google Fit data",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const comprehensiveSync = async () => {
    if (!user) return;

    setIsSyncing(true);
    try {
      console.log('Starting comprehensive sync process...');
      
      // Force refresh the token first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      console.log('Session found, refreshing token...');

      // Call the refresh token function first
      const { data: refreshData, error: refreshError } = await supabase.functions.invoke('refresh-google-fit-token-v2', {
        body: {
          user_id: user.id,
          force_refresh: true
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (refreshError) {
        console.warn('Token refresh failed, proceeding with existing token:', refreshError);
        toast({
          title: "Token refresh warning",
          description: "Could not refresh token, using existing one",
          variant: "destructive",
        });
      } else {
        console.log('Token refreshed successfully:', refreshData);
      }

      // Now sync with the refreshed token using comprehensive sync
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        throw new Error('No Google Fit access token available');
      }

      console.log('Starting comprehensive sync (using unified sync-all-google-fit-data) with token:', accessToken.substring(0, 20) + '...');

      const { data, error } = await supabase.functions.invoke('sync-all-google-fit-data', {
        body: { 
          accessToken,
          days: 7
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log('Unified sync response:', { data, error });

      if (error) {
        console.error('Unified sync function error:', error);
        throw new Error(`Sync failed: ${error.message || 'Unknown error'}`);
      }

      toast({
        title: "Sync successful!",
        description: data?.message || "Google Fit data synced successfully",
      });

      // Reload data after sync
      await loadData();

    } catch (error) {
      console.error('Error in comprehensive sync:', error);
      toast({
        title: "Comprehensive sync failed",
        description: error instanceof Error ? error.message : "Failed to sync Google Fit data",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, days]);

  // Prepare chart data
  const chartData = data.map(d => ({
    date: format(parseISO(d.date), 'MMM dd'),
    steps: d.steps,
    calories: Math.round(d.calories_burned),
    activeMinutes: d.active_minutes,
    distance: Math.round(d.distance_meters / 1000 * 100) / 100, // Convert to km
    heartRate: d.heart_rate_avg
  }));

  const activityData = sessions.reduce((acc, session) => {
    const activity = session.activity_type.toLowerCase();
    const existing = acc.find(item => item.activity === activity);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ activity, count: 1 });
    }
    return acc;
  }, [] as { activity: string; count: number }[]);

  const weeklyData = data.reduce((acc, d) => {
    const week = format(parseISO(d.date), 'yyyy-\'W\'ww');
    const existing = acc.find(item => item.week === week);
    if (existing) {
      existing.steps += d.steps;
      existing.calories += d.calories_burned;
      existing.activeMinutes += d.active_minutes;
      existing.distance += d.distance_meters;
    } else {
      acc.push({
        week,
        steps: d.steps,
        calories: d.calories_burned,
        activeMinutes: d.active_minutes,
        distance: d.distance_meters
      });
    }
    return acc;
  }, [] as any[]);

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-none mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl mb-2">Google Fit Debug</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View and sync your Google Fit data with detailed analytics
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Data Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Days to sync:</label>
                <select 
                  value={days} 
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="px-3 py-1 border rounded-md"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>
              <Button 
                onClick={syncAllData} 
                disabled={isSyncing}
                className="flex items-center gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync All Data'}
              </Button>
              <Button 
                onClick={manualSync} 
                disabled={isSyncing}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {isSyncing ? 'Syncing...' : 'Manual Sync'}
              </Button>
              <Button 
                onClick={comprehensiveSync} 
                disabled={isSyncing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync (Unified)'}
              </Button>
              <Button 
                onClick={loadData} 
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalSessions}</p>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalDistance}km</p>
                    <p className="text-xs text-muted-foreground">Distance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalCalories}</p>
                    <p className="text-xs text-muted-foreground">Calories</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalActiveMinutes}</p>
                    <p className="text-xs text-muted-foreground">Active Min</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="daily">Daily Trends</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Steps Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="steps" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Calories Burned</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="calories" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distance (km)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="distance" stroke="#ffc658" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Minutes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="activeMinutes" fill="#ff7300" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activities" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={activityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ activity, percent }) => `${activity} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {activityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Counts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {activityData.map((item, index) => (
                      <div key={item.activity} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium capitalize">{item.activity}</span>
                        </div>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="steps" stroke="#8884d8" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="calories" stroke="#82ca9d" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
                <CardDescription>Your latest Google Fit activity sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.slice(0, 20).map((session) => {
                    const startTime = new Date(session.start_time);
                    const endTime = new Date(session.end_time);
                    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
                    
                    return (
                      <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Activity className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{session.activity_type}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(startTime, 'MMM dd, yyyy')} at {format(startTime, 'HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{duration} min</p>
                          <p className="text-xs text-muted-foreground">
                            {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
