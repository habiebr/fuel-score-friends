import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface WeeklyKilometersCardProps {
  current: number;
  target: number;
}

export function WeeklyKilometersCard({ current, target }: WeeklyKilometersCardProps) {
  const percentage = Math.round((current / target) * 100);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-base text-foreground">Weekly Kilometers</h3>
          </div>
          <Badge variant="secondary" className="border border-border/40 bg-muted/40 text-foreground">
            {percentage}%
          </Badge>
        </div>

        <div className="flex items-end gap-3">
          <div className="text-4xl font-bold text-primary">
            {current.toFixed(1)}
          </div>
          <div className="pb-2 text-sm text-muted-foreground">
            of {target} km
          </div>
        </div>

        <div className="mt-3 h-2.5 w-full rounded-full bg-muted/60">
          <div
            className="h-2.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
