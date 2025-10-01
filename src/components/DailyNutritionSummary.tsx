import { Card, CardContent } from '@/components/ui/card';

export function DailyNutritionSummary() {
  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Activity metrics will appear here</p>
        </div>
      </CardContent>
    </Card>
  );
}
