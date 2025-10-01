import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UploadProvider } from "@/contexts/UploadContext";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Goals from "./pages/Goals";
import Community from "./pages/Community";
import Auth from "./pages/Auth";
import Import from "./pages/Import";
import Meals from "./pages/Meals";
import NotFound from "./pages/NotFound";
import { GlobalUploadIndicator } from "@/components/GlobalUploadIndicator";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function App() {
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UploadProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GlobalUploadIndicator />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/community" element={<Community />} />
              <Route path="/import" element={<Import />} />
              <Route path="/meals" element={<Meals />} />
              <Route path="/auth" element={<Auth />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </UploadProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
}

export default App;
