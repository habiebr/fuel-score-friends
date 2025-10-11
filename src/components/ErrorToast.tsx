import { useToast } from "@/hooks/useToast";

export function showErrorToast(message: string, details?: string) {
  const { toast } = useToast();
  
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
  
  if (details) {
    console.error(message, details);
  }
}

export function showCorsErrorToast() {
  const { toast } = useToast();
  
  toast({
    title: "Connection Error",
    description: "There was a problem connecting to the server. Please try again.",
    variant: "destructive",
  });
  
  console.error("CORS or network error detected");
}

export function showAuthErrorToast() {
  const { toast } = useToast();
  
  toast({
    title: "Authentication Error",
    description: "Your session may have expired. Please log in again.",
    variant: "destructive",
  });
  
  console.error("Authentication error detected");
}