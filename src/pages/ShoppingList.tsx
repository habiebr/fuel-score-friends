import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addDays, format, parseISO } from 'date-fns';
import { PageHeading } from '@/components/PageHeading';

type PlanRow = {
  date: string;
  meal_type: string;
  meal_suggestions?: any[] | null;
};

type ShoppingItem = {
  name: string;
  quantity?: string;
  count: number;
};

export default function ShoppingList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlanRow[]>([]);

  const params = new URLSearchParams(location.search);
  const startParam = params.get('start');
  const startDate = startParam ? parseISO(startParam) : new Date();
  const endDate = addDays(startDate, 6);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');
        const { data } = await supabase
          .from('daily_meal_plans')
          .select('date, meal_type, meal_suggestions')
          .eq('user_id', user.id)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date');
        setRows((data as any) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, startParam]);

  const items = useMemo(() => {
    const map = new Map<string, ShoppingItem>();
    const pushItem = (raw: string) => {
      const text = (raw || '').trim();
      if (!text) return;
      // naive parse: split on last space for qty; keep name normalized
      const match = text.match(/^(.+?)\s+([0-9]+\s*.*)$/);
      const name = (match ? match[1] : text).toLowerCase();
      const qty = match ? match[2] : undefined;
      if (!map.has(name)) map.set(name, { name, quantity: qty, count: 1 });
      else {
        const cur = map.get(name)!;
        cur.count += 1;
        // preserve first seen quantity; could be enhanced later
      }
    };

    rows.forEach((r) => {
      const suggestions = Array.isArray(r.meal_suggestions) ? r.meal_suggestions : [];
      suggestions.forEach((s: any) => {
        const foods: string[] = Array.isArray(s.foods) ? s.foods : [];
        foods.forEach(pushItem);
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-none mx-auto p-4">
        <div className="mb-2">
          <Button
            variant="ghost"
            onClick={() => navigate(`/meal-plans?start=${format(startDate, 'yyyy-MM-dd')}`)}
            className="-ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to 7-Day Plans
          </Button>
        </div>
        <PageHeading
          title="Shopping List"
          description={`${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')}`}
          className="mt-3"
        />

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Ingredients
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-muted-foreground">No meal plan items available.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item) => (
                  <div key={item.name} className="p-3 bg-muted/20 rounded border flex items-center justify-between">
                    <div className="capitalize font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.quantity ? item.quantity + ' • ' : ''}x{item.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
