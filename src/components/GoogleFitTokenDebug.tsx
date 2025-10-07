import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function GoogleFitTokenDebug() {
  const { getGoogleAccessToken } = useAuth();
  const { toast } = useToast();
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadTokenInfo = async () => {
    try {
      const token = await getGoogleAccessToken();
      
      const info = {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : null,
        fullToken: token,
        localStorage: {
          google_fit_connected: localStorage.getItem('google_fit_connected'),
          google_fit_token: localStorage.getItem('google_fit_token'),
          google_fit_refresh_token: localStorage.getItem('google_fit_refresh_token'),
          google_fit_token_expiry: localStorage.getItem('google_fit_token_expiry'),
          google_fit_provider_token: localStorage.getItem('google_fit_provider_token'),
        },
        expiry: null as Date | null,
        isExpired: false,
        timeUntilExpiry: null as string | null,
      };

      // Check expiry
      const expiryStr = localStorage.getItem('google_fit_token_expiry');
      if (expiryStr) {
        const expiry = parseInt(expiryStr, 10);
        info.expiry = new Date(expiry);
        info.isExpired = Date.now() > expiry;
        
        const timeDiff = expiry - Date.now();
        if (timeDiff > 0) {
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          info.timeUntilExpiry = `${hours}h ${minutes}m`;
        } else {
          const hours = Math.floor(-timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((-timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          info.timeUntilExpiry = `Expired ${hours}h ${minutes}m ago`;
        }
      }

      setTokenInfo(info);
    } catch (error) {
      console.error('Error loading token info:', error);
      setTokenInfo({
        error: error instanceof Error ? error.message : 'Unknown error',
        hasToken: false,
      });
    }
  };

  const copyToken = async () => {
    if (tokenInfo?.fullToken) {
      try {
        await navigator.clipboard.writeText(tokenInfo.fullToken);
        setCopied(true);
        toast({
          title: 'Token copied',
          description: 'Google Fit token copied to clipboard',
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast({
          title: 'Copy failed',
          description: 'Could not copy token to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const clearTokens = () => {
    localStorage.removeItem('google_fit_connected');
    localStorage.removeItem('google_fit_token');
    localStorage.removeItem('google_fit_refresh_token');
    localStorage.removeItem('google_fit_token_expiry');
    localStorage.removeItem('google_fit_provider_token');
    toast({
      title: 'Tokens cleared',
      description: 'All Google Fit tokens have been cleared from local storage',
    });
    loadTokenInfo();
  };

  useEffect(() => {
    loadTokenInfo();
  }, []);

  if (!tokenInfo) {
    return (
      <Card>
        <CardContent className="p-4">
          <p>Loading token information...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Google Fit Token Debug
        </CardTitle>
        <CardDescription>
          Detailed information about your Google Fit authentication tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token Status */}
        <div className="flex items-center gap-2">
          <span className="font-medium">Token Status:</span>
          <Badge variant={tokenInfo.hasToken ? 'default' : 'destructive'}>
            {tokenInfo.hasToken ? 'Present' : 'Missing'}
          </Badge>
          {tokenInfo.isExpired && (
            <Badge variant="destructive">Expired</Badge>
          )}
        </div>

        {/* Token Preview */}
        {tokenInfo.hasToken && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Token Preview:</span>
              <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {tokenInfo.tokenPreview}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={copyToken}
                disabled={copied}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            
            {showToken && (
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                <code className="text-xs break-all">{tokenInfo.fullToken}</code>
              </div>
            )}
          </div>
        )}

        {/* Expiry Information */}
        {tokenInfo.expiry && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Expires:</span>
              <span className="text-sm">{tokenInfo.expiry.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Time until expiry:</span>
              <Badge variant={tokenInfo.isExpired ? 'destructive' : 'default'}>
                {tokenInfo.timeUntilExpiry}
              </Badge>
            </div>
          </div>
        )}

        {/* Local Storage Contents */}
        <div className="space-y-2">
          <span className="font-medium">Local Storage Contents:</span>
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg space-y-1">
            {Object.entries(tokenInfo.localStorage).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="font-mono">{key}:</span>
                <span className="text-gray-600 dark:text-gray-400">
                  {value ? (value.length > 50 ? `${value.substring(0, 50)}...` : value) : 'null'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={loadTokenInfo} variant="outline" size="sm">
            Refresh Info
          </Button>
          <Button onClick={clearTokens} variant="destructive" size="sm">
            Clear All Tokens
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
