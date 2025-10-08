import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bug, 
  Database, 
  Activity, 
  Settings, 
  ChevronRight,
  ExternalLink,
  Code,
  BarChart3,
  Key,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function DebugMenu() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { user, getGoogleAccessToken } = useAuth();
  const [tokenStatus, setTokenStatus] = useState<{
    hasToken: boolean;
    expiresAt: string | null;
    refreshCount: number | null;
    lastRefreshed: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Load token status
  useEffect(() => {
    const loadTokenStatus = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Check if user has a valid token
        const token = await getGoogleAccessToken();
        
        // Get token details from database
        const { data: tokenData } = await supabase
          .from('google_tokens')
          .select('expires_at, refresh_count, last_refreshed_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        setTokenStatus({
          hasToken: !!token,
          expiresAt: tokenData?.expires_at || null,
          refreshCount: tokenData?.refresh_count || null,
          lastRefreshed: tokenData?.last_refreshed_at || null,
        });
      } catch (error) {
        console.error('Failed to load token status:', error);
        setTokenStatus({
          hasToken: false,
          expiresAt: null,
          refreshCount: null,
          lastRefreshed: null,
        });
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadTokenStatus();
    }
  }, [user, getGoogleAccessToken, isOpen]);

  const debugItems = [
    {
      id: 'supabase',
      title: 'Supabase Debug',
      description: 'Database queries, tables, and data inspection',
      icon: <Database className="h-5 w-5" />,
      path: '/debug/supabase',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20'
    },
    {
      id: 'google-fit',
      title: 'Google Fit Debug',
      description: 'Google Fit data sync, charts, and analytics',
      icon: <Activity className="h-5 w-5" />,
      path: '/debug/google-fit',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    },
    {
      id: 'api-logs',
      title: 'API Logs',
      description: 'View API request logs and responses',
      icon: <Code className="h-5 w-5" />,
      path: '/debug/api-logs',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20'
    },
    {
      id: 'performance',
      title: 'Performance',
      description: 'App performance metrics and monitoring',
      icon: <BarChart3 className="h-5 w-5" />,
      path: '/debug/performance',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20'
    },
    {
      id: 'dashboard2',
      title: 'Dashboard2',
      description: 'Enhanced dashboard with better performance',
      icon: <BarChart3 className="h-5 w-5" />,
      path: '/dashboard2',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    },
    {
      id: 'force-sync',
      title: 'Force Sync',
      description: 'Clear and force sync Google Fit data (exercise only)',
      icon: <RefreshCw className="h-5 w-5" />,
      path: '/debug/force-sync',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20'
    }
  ];

  if (!isOpen) {
    return (
      <Card className="shadow-card cursor-pointer" onClick={() => setIsOpen(true)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Bug className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">Debug Tools</h3>
              <p className="text-sm text-muted-foreground">Developer tools and diagnostics</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <CardTitle>Debug Tools</CardTitle>
            <Badge variant="secondary" className="ml-2">Developer</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
        <CardDescription>
          Developer tools for debugging and monitoring the application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Google Fit Token Status */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-foreground">Google Fit Token Status</h4>
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          
          {tokenStatus ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={tokenStatus.hasToken ? "default" : "destructive"}>
                  {tokenStatus.hasToken ? "Connected" : "Not Connected"}
                </Badge>
              </div>
              
              {tokenStatus.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="text-foreground">
                    {new Date(tokenStatus.expiresAt).toLocaleString()}
                  </span>
                </div>
              )}
              
              {tokenStatus.refreshCount !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Refresh Count:</span>
                  <span className="text-foreground">{tokenStatus.refreshCount}</span>
                </div>
              )}
              
              {tokenStatus.lastRefreshed && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Refreshed:</span>
                  <span className="text-foreground">
                    {new Date(tokenStatus.lastRefreshed).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No token data available</p>
          )}
        </div>

        {debugItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => navigate(item.path)}
          >
            <div className={`w-10 h-10 ${item.bgColor} rounded-full flex items-center justify-center`}>
              <div className={item.color}>
                {item.icon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground">{item.title}</h4>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
        
        <div className="pt-3 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Note:</strong> These tools are for development and debugging purposes only.</p>
            <p>Use with caution in production environments.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
