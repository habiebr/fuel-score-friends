import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays } from 'date-fns';
import { Activity, Heart, TrendingUp } from 'lucide-react';

interface WearableData {
  date: string;
  steps: number;
  calories: number;
  heartRate: number;
  displayDate: string;
}

export function WearablePerformanceGraph() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [data, setData] = useState<WearableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'steps' | 'calories' | 'heartRate'>('steps');

  useEffect(() => {
    if (user) {
      loadWearableData();
    }
  }, [user, period]);

  const loadWearableData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let startDate: Date;
      let endDate = new Date();

      switch (period) {
        case 'daily':
          startDate = subDays(endDate, 7); // Last 7 days
          break;
        case 'weekly':
          startDate = subDays(endDate, 28); // Last 4 weeks
          break;
        case 'monthly':
          startDate = subDays(endDate, 90); // Last 3 months
          break;
      }

      const { data: wearableData } = await supabase
        .from('wearable_data')
        .select('date, steps, calories_burned, heart_rate_avg')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (wearableData && wearableData.length > 0) {
        const formattedData = wearableData.map(item => ({
          date: item.date,
          steps: item.steps || 0,
          calories: item.calories_burned || 0,
          heartRate: item.heart_rate_avg || 0,
          displayDate: formatDateForPeriod(item.date, period)
        }));

        setData(formattedData);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('Error loading wearable data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForPeriod = (dateStr: string, periodType: string): string => {
    const date = new Date(dateStr);
    
    switch (periodType) {
      case 'daily':
        return format(date, 'MMM dd');
      case 'weekly':
        return `Week ${format(date, 'w')}`;
      case 'monthly':
        return format(date, 'MMM yyyy');
      default:
        return format(date, 'MMM dd');
    }
  };

  const getMetricInfo = () => {
    switch (metric) {
      case 'steps':
        return {
          title: 'Steps',
          icon: <Activity className="h-4 w-4 text-primary" />,
          color: 'hsl(var(--primary))',
          dataKey: 'steps'
        };
      case 'calories':
        return {
          title: 'Calories Burned',
          icon: <TrendingUp className="h-4 w-4 text-secondary" />,
          color: 'hsl(var(--secondary))',
          dataKey: 'calories'
        };
      case 'heartRate':
        return {
          title: 'Average Heart Rate',
          icon: <Heart className="h-4 w-4 text-accent" />,
          color: 'hsl(var(--accent))',
          dataKey: 'heartRate'
        };
    }
  };

  const metricInfo = getMetricInfo();
  const averageValue = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d[metricInfo.dataKey], 0) / data.length)
    : 0;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-lg sm:text-xl">Wearable Performance</CardTitle>
        </div>
        
        {/* Metric Selection */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMetric('steps')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              metric === 'steps'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Activity className="h-4 w-4" />
            Steps
          </button>
          <button
            onClick={() => setMetric('calories')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              metric === 'calories'
                ? 'bg-secondary/10 text-secondary border border-secondary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Calories
          </button>
          <button
            onClick={() => setMetric('heartRate')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              metric === 'heartRate'
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Heart className="h-4 w-4" />
            Heart Rate
          </button>
        </div>

        {data.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Average {metricInfo.title.toLowerCase()}: {averageValue}
            {metric === 'heartRate' ? ' bpm' : ''}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="mt-0">
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
              </div>
            ) : data.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p>No wearable data available</p>
                  <p className="text-sm mt-2">Upload .fit files to see your activity!</p>
                </div>
              </div>
            ) : metric === 'calories' ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar 
                    dataKey={metricInfo.dataKey}
                    fill={metricInfo.color}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={metricInfo.dataKey}
                    stroke={metricInfo.color}
                    strokeWidth={2}
                    dot={{ fill: metricInfo.color, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
