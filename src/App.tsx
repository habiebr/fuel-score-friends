import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UploadProvider } from "@/contexts/UploadContext";
import { ErrorBoundary } from "react-error-boundary";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Goals from "./pages/Goals";
import Community from "./pages/Community";
import Auth from "./pages/Auth";
import Import from "./pages/Import";
import Meals from "./pages/Meals";
import MarathonCalendarPage from "./pages/MarathonCalendarPage";
import Offline from "./pages/Offline";
import NotFound from "./pages/NotFound";
import { GlobalUploadIndicator } from "@/components/GlobalUploadIndicator";
import { PWAUpdateNotification } from "@/components/PWAUpdateNotification";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-slate-300">
            The app encountered an error. This might be due to missing configuration.
          </p>
          <details className="text-left text-sm text-slate-400">
            <summary className="cursor-pointer">Error details</summary>
            <pre className="mt-2 p-2 bg-slate-800 rounded text-xs overflow-auto">
              {error.message}
            </pre>
          </details>
        </div>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo);
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UploadProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <GlobalUploadIndicator />
              <PWAUpdateNotification />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/marathons" element={<MarathonCalendarPage />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/meals" element={<Meals />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/offline" element={<Offline />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </UploadProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
