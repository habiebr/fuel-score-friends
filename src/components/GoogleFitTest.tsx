import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  ExternalLink,
  Activity
} from 'lucide-react';
import { useGoogleFit } from '@/hooks/useGoogleFit';

export function GoogleFitTest() {
  const { 
    isLoaded, 
    isAuthorized, 
    isLoading, 
    error, 
    authorize, 
    signOut, 
    fetchTodayData 
  } = useGoogleFit();
  
  const [testResults, setTestResults] = useState<{
    apiLoad: boolean;
    auth: boolean;
    dataFetch: boolean;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runTests = async () => {
    setIsTesting(true);
    const results = {
      apiLoad: false,
      auth: false,
      dataFetch: false,
      error: undefined as string | undefined
    };

    try {
      // Test 1: API Load
      results.apiLoad = isLoaded;
      
      // Test 2: Authorization
      if (isLoaded) {
        if (!isAuthorized) {
          const authSuccess = await authorize();
          results.auth = authSuccess;
        } else {
          results.auth = true;
        }
      }

      // Test 3: Data Fetch
      if (results.auth) {
        try {
          const data = await fetchTodayData();
          results.dataFetch = !!data;
        } catch (err) {
          results.dataFetch = false;
          results.error = err instanceof Error ? err.message : 'Unknown error';
        }
      }

      setTestResults(results);
    } catch (err) {
      results.error = err instanceof Error ? err.message : 'Unknown error';
      setTestResults(results);
    } finally {
      setIsTesting(false);
    }
  };

  const getTestStatus = (test: boolean) => {
    return test ? (
      <Badge className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" />
        Pass
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Fail
      </Badge>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5 text-purple-500" />
          Google Fit Integration Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Current Status</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>API Loaded:</span>
              {isLoaded ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>Authorized:</span>
              {isAuthorized ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Test Button */}
        <Button 
          onClick={runTests}
          disabled={isTesting || isLoading}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
          {isTesting ? 'Running Tests...' : 'Run Integration Tests'}
        </Button>

        {/* Test Results */}
        {testResults && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Test Results</h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">API Load Test</span>
                {getTestStatus(testResults.apiLoad)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Authorization Test</span>
                {getTestStatus(testResults.auth)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Data Fetch Test</span>
                {getTestStatus(testResults.dataFetch)}
              </div>
            </div>

            {testResults.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Error: {testResults.error}
                </AlertDescription>
              </Alert>
            )}

            {/* Overall Status */}
            <div className="mt-4 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                {testResults.apiLoad && testResults.auth && testResults.dataFetch ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-semibold text-green-600">
                      All tests passed! Google Fit integration is working correctly.
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-semibold text-red-600">
                      Some tests failed. Check the setup guide and try again.
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://console.cloud.google.com/', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Google Console
          </Button>
          
          {isAuthorized && (
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
            >
              <Activity className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold">Setup Required:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Create Google Cloud Project</li>
            <li>Enable Google Fit API</li>
            <li>Create OAuth 2.0 credentials</li>
            <li>Set environment variables</li>
            <li>Run tests to verify</li>
          </ol>
          <p className="mt-2 text-blue-600">
            See GOOGLE_FIT_SETUP.md for detailed instructions
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
