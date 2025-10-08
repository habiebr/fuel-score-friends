import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { MarathonCalendar } from '@/components/MarathonCalendar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { PageHeading } from '@/components/PageHeading';

export default function MarathonCalendarPage() {
  const navigate = useNavigate();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);

  return (
    <>
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          {/* Header */}
          <div className="mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/goals')} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Goals
            </Button>
          </div>
          <PageHeading
            title="Marathon Calendar"
            description="Browse upcoming marathons and set your race goal."
            className="mt-3"
          />

          {/* Calendar Component */}
          <MarathonCalendar />
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
