import React from 'react';
import { PageHeading } from '@/components/PageHeading';
import { CachedStepsWidget, CachedCaloriesWidget, CachedMealsWidget } from '@/components/CachedWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database, Clock, Zap } from 'lucide-react';
import { useWidgetCache, getCacheStats, clearUserCache } from '@/hooks/useWidgetCache';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CachedWidget } from '@/components/CachedWidget';

export function CachedWidgetsDemo() {
  const { user } = useAuth();
  const [cacheStats, setCacheStats] = React.useState<any>(null);

  const refreshCacheStats = () => {
    setCacheStats(getCacheStats());
  };

  const clearAllCaches = () => {
    if (user?.id) {
      clearUserCache(user.id);
      refreshCacheStats();
    }
  };

  React.useEffect(() => {
    refreshCacheStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-none mx-auto p-4">
        <PageHeading
          title="Cached Widgets Demo"
          description="Demonstrating efficient widget caching with data-only refresh"
        />

        {/* Cache Statistics */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{cacheStats?.totalEntries || 0}</div>
                <div className="text-sm text-muted-foreground">Cached Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {cacheStats?.entries?.filter((e: any) => e.age < 60000).length || 0}
                </div>
                  <div className="text-sm text-muted-foreground">Fresh (&lt; 1min)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {cacheStats?.entries?.filter((e: any) => e.age >= 60000).length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Stale (&gt; 1min)</div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={refreshCacheStats}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Stats
              </Button>
              <Button variant="outline" size="sm" onClick={clearAllCaches}>
                <Database className="h-4 w-4 mr-2" />
                Clear All Caches
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Caching Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="font-semibold text-green-800">Faster Loading</div>
                <div className="text-sm text-green-600">Instant data from cache</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="font-semibold text-blue-800">Reduced API Calls</div>
                <div className="text-sm text-blue-600">Fewer database queries</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <RefreshCw className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <div className="font-semibold text-purple-800">Smart Refresh</div>
                <div className="text-sm text-purple-600">Data-only updates</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Zap className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <div className="font-semibold text-orange-800">Better UX</div>
                <div className="text-sm text-orange-600">Smooth interactions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cached Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CachedStepsWidget />
          <CachedCaloriesWidget />
          <CachedMealsWidget />
          
          {/* Additional demo widgets */}
          <CachedWidget
            title="Active Minutes"
            cacheKey="active-minutes-widget"
            fetchFunction={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('No user');
              
              const today = new Date().toISOString().split('T')[0];
              const { data, error } = await supabase
                .from('google_fit_data')
                .select('active_minutes')
                .eq('user_id', user.id)
                .eq('date', today)
                .single();
              
              if (error) throw error;
              return data?.active_minutes || 0;
            }}
            renderContent={(minutes) => (
              <div className="text-center">
                <div className="text-2xl font-bold">{minutes}</div>
                <div className="text-sm text-muted-foreground">active minutes</div>
              </div>
            )}
            ttl={5 * 60 * 1000} // 5 minutes
          />

          <CachedWidget
            title="Calories Burned"
            cacheKey="calories-burned-widget"
            fetchFunction={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('No user');
              
              const today = new Date().toISOString().split('T')[0];
              const { data, error } = await supabase
                .from('google_fit_data')
                .select('calories_burned')
                .eq('user_id', user.id)
                .eq('date', today)
                .single();
              
              if (error) throw error;
              return data?.calories_burned || 0;
            }}
            renderContent={(calories) => (
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(calories)}</div>
                <div className="text-sm text-muted-foreground">calories burned</div>
              </div>
            )}
            ttl={3 * 60 * 1000} // 3 minutes
          />

          <CachedWidget
            title="Weekly Distance"
            cacheKey="weekly-distance-widget"
            fetchFunction={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('No user');
              
              const today = new Date().toISOString().split('T')[0];
              const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              
              const { data, error } = await supabase
                .from('google_fit_data')
                .select('distance_meters')
                .eq('user_id', user.id)
                .gte('date', weekStart)
                .lte('date', today);
              
              if (error) throw error;
              
              const totalDistance = (data || []).reduce((sum, d) => sum + (d.distance_meters || 0), 0) / 1000;
              return totalDistance;
            }}
            renderContent={(distance) => (
              <div className="text-center">
                <div className="text-2xl font-bold">{distance.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">km this week</div>
              </div>
            )}
            ttl={10 * 60 * 1000} // 10 minutes
          />
        </div>

        {/* Performance Notes */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Performance Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>Cache Hit:</strong> Data loads instantly from memory</p>
              <p>• <strong>Cache Miss:</strong> Fresh data fetched from database</p>
              <p>• <strong>TTL Expired:</strong> Cache automatically refreshed</p>
              <p>• <strong>Manual Refresh:</strong> Force update with refresh button</p>
              <p>• <strong>Memory Efficient:</strong> Automatic cleanup of expired entries</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
