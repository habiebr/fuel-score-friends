import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

export function GoogleFitTokenRefresh() {
  const { getGoogleAccessToken, signInWithGoogle } = useAuth();
  const { isConnected, syncGoogleFit } = useGoogleFitSync();
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'expired' | 'missing'>('checking');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkTokenStatus = async () => {
    setTokenStatus('checking');
    setLastChecked(new Date());
    
    try {
      const token = await getGoogleAccessToken();
      
      if (!token) {
        setTokenStatus('missing');
        return;
      }

      // Check token validity by making an API call

      // Test the token by making a simple API call
      try {
        const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          setTokenStatus('valid');
        } else if (response.status === 401) {
          setTokenStatus('expired');
        } else {
          console.error('Unexpected response:', response.status);
          setTokenStatus('expired');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setTokenStatus('expired');
      }
    } catch (error) {
      console.error('Error checking token status:', error);
      setTokenStatus('missing');
    }
  };

  const refreshToken = async () => {
    setIsRefreshing(true);
    
    try {
      // Force refresh the token
      const newToken = await getGoogleAccessToken({ forceRefresh: true });
      
      if (newToken) {
        // Test the new token
        const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          setTokenStatus('valid');
          // Trigger a sync to test the connection
          await syncGoogleFit();
        } else {
          setTokenStatus('expired');
        }
      } else {
        setTokenStatus('missing');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setTokenStatus('expired');
    } finally {
      setIsRefreshing(false);
    }
  };

  const reconnectGoogleFit = async () => {
    setIsRefreshing(true);
    
    try {
      await signInWithGoogle();
      // Wait a moment for the OAuth flow to complete
      setTimeout(() => {
        checkTokenStatus();
      }, 2000);
    } catch (error) {
      console.error('Error reconnecting Google Fit:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Clear any stored token on mount
    try {
      localStorage.removeItem('google_fit_provider_token');
    } catch {}
    checkTokenStatus();
  }, []);

  const getStatusIcon = () => {
    switch (tokenStatus) {
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusMessage = () => {
    switch (tokenStatus) {
      case 'checking':
        return 'Checking token status...';
      case 'valid':
        return 'Google Fit token is valid and working';
      case 'expired':
        return 'Google Fit token has expired and needs to be refreshed';
      case 'missing':
        return 'No Google Fit token found. Please connect your Google account.';
      default:
        return 'Unknown token status';
    }
  };

  const getStatusColor = () => {
    switch (tokenStatus) {
      case 'valid':
        return 'text-green-600';
      case 'expired':
        return 'text-red-600';
      case 'missing':
        return 'text-gray-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Google Fit Token Status
        </CardTitle>
        <CardDescription>
          Monitor and refresh your Google Fit authentication token
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className={getStatusColor()}>
            {getStatusMessage()}
          </AlertDescription>
        </Alert>

        {lastChecked && (
          <p className="text-sm text-gray-500">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={checkTokenStatus}
            variant="outline"
            disabled={isRefreshing}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Check Token Status
          </Button>

          {tokenStatus === 'expired' && (
            <Button
              onClick={refreshToken}
              disabled={isRefreshing}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Token
            </Button>
          )}

          {(tokenStatus === 'missing' || tokenStatus === 'expired') && (
            <Button
              onClick={reconnectGoogleFit}
              disabled={isRefreshing}
              variant="secondary"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Reconnect Google Fit
            </Button>
          )}

          {tokenStatus === 'valid' && (
            <Button
              onClick={syncGoogleFit}
              disabled={isRefreshing}
              variant="secondary"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Test Sync
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500">
          <p><strong>Connection Status:</strong> {isConnected ? 'Connected' : 'Not Connected'}</p>
        </div>
      </CardContent>
    </Card>
  );
}
