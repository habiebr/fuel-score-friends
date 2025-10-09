import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, Database } from 'lucide-react';
import { useWidgetCache } from '@/hooks/useWidgetCache';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CachedWidgetProps {
  title: string;
  cacheKey: string;
  fetchFunction: () => Promise<any>;
  renderContent: (data: any) => React.ReactNode;
  ttl?: number;
  className?: string;
}

export function CachedWidget({ 
  title, 
  cacheKey, 
  fetchFunction, 
  renderContent, 
  ttl = 5 * 60 * 1000,
  className = ""
}: CachedWidgetProps) {
  const { user } = useAuth();
  
  const {
    data,
    loading,
    error,
    lastUpdated,
    refreshData,
    isCached
  } = useWidgetCache(cacheKey, fetchFunction, { ttl });

  const handleRefresh = async () => {
    try {
      await refreshData();
    } catch (err) {
      console.error('Failed to refresh widget data:', err);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {/* Cache indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isCached ? (
              <>
                <Database className="h-3 w-3 text-green-500" />
                <span>Cached</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 text-yellow-500" />
                <span>Live</span>
              </>
            )}
          </div>
          
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading && !data ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-500 mb-2">Failed to load data</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        ) : data ? (
          <>
            {renderContent(data)}
            {lastUpdated && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Updated {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Example usage components
export function CachedStepsWidget() {
  return (
    <CachedWidget
      title="Today's Steps"
      cacheKey="steps-widget"
      fetchFunction={async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user');
        
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('google_fit_data')
          .select('steps')
          .eq('user_id', user.id)
          .eq('date', today)
          .single();
        
        if (error) throw error;
        return data?.steps || 0;
      }}
      renderContent={(steps) => (
        <div className="text-center">
          <div className="text-2xl font-bold">{steps.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">steps today</div>
        </div>
      )}
      ttl={2 * 60 * 1000} // 2 minutes
    />
  );
}

export function CachedCaloriesWidget() {
  return (
    <CachedWidget
      title="Calories Consumed"
      cacheKey="calories-widget"
      fetchFunction={async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user');
        
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('food_logs')
          .select('calories')
          .eq('user_id', user.id)
          .gte('logged_at', `${today}T00:00:00`)
          .lt('logged_at', `${today}T23:59:59.999`);
        
        if (error) throw error;
        
        const totalCalories = (data || []).reduce((sum, log) => sum + (log.calories || 0), 0);
        return totalCalories;
      }}
      renderContent={(calories) => (
        <div className="text-center">
          <div className="text-2xl font-bold">{Math.round(calories)}</div>
          <div className="text-sm text-muted-foreground">calories consumed</div>
        </div>
      )}
      ttl={1 * 60 * 1000} // 1 minute
    />
  );
}

export function CachedMealsWidget() {
  return (
    <CachedWidget
      title="Meals Logged"
      cacheKey="meals-widget"
      fetchFunction={async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user');
        
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('food_logs')
          .select('meal_type')
          .eq('user_id', user.id)
          .gte('logged_at', `${today}T00:00:00`)
          .lt('logged_at', `${today}T23:59:59.999`);
        
        if (error) throw error;
        
        const mealTypes = [...new Set((data || []).map(log => log.meal_type).filter(Boolean))];
        return {
          count: mealTypes.length,
          types: mealTypes
        };
      }}
      renderContent={(meals) => (
        <div className="text-center">
          <div className="text-2xl font-bold">{meals.count}</div>
          <div className="text-sm text-muted-foreground">meals logged</div>
          {meals.types.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {meals.types.join(', ')}
            </div>
          )}
        </div>
      )}
      ttl={3 * 60 * 1000} // 3 minutes
    />
  );
}
