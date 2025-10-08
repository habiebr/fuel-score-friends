import { BottomNav } from '@/components/BottomNav';
import { Dashboard3 } from '@/components/Dashboard3';

export default function Dashboard3Page() {
  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          <Dashboard3 />
        </div>
      </div>
      <BottomNav />
    </>
  );
}


