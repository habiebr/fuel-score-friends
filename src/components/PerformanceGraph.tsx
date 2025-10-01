import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScoreData {
  date: string;
  score: number;
  displayDate: string;
}

export function PerformanceGraph() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [data, setData] = useState<ScoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  useEffect(() => {
    if (user) {
      loadPerformanceData();
    }
  }, [user, period]);

  const loadPerformanceData = async () => {
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

      const { data: scores } = await supabase
        .from('nutrition_scores')
        .select('date, daily_score')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (scores && scores.length > 0) {
        const formattedData = scores.map(score => ({
          date: score.date,
          score: score.daily_score,
          displayDate: formatDateForPeriod(score.date, period)
        }));

        setData(formattedData);
        calculateTrend(formattedData);
      } else {
        setData([]);
        setTrend('stable');
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
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

  const calculateTrend = (scores: ScoreData[]) => {
    if (scores.length < 2) {
      setTrend('stable');
      return;
    }

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.score, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;

    if (difference > 5) {
      setTrend('up');
    } else if (difference < -5) {
      setTrend('down');
    } else {
      setTrend('stable');
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendText = () => {
    switch (trend) {
      case 'up':
        return 'Improving';
      case 'down':
        return 'Declining';
      default:
        return 'Stable';
    }
  };

  const averageScore = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length)
    : 0;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg sm:text-xl">Performance</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            {getTrendIcon()}
            <span className={`font-medium ${
              trend === 'up' ? 'text-success' :
              trend === 'down' ? 'text-destructive' :
              'text-muted-foreground'
            }`}>
              {getTrendText()}
            </span>
          </div>
        </div>
        {data.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Average score: {averageScore}/100
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
                  <p>No data available for this period</p>
                  <p className="text-sm mt-2">Start logging meals to see your progress!</p>
                </div>
              </div>
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
                    domain={[0, 100]}
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
                    dataKey="score" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
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