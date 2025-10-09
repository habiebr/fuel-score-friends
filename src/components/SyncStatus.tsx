import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { SyncPhase } from '@/services/unified-sync.service';

interface SyncStatusProps {
  phases: SyncPhase[];
  isRunning: boolean;
  lastSync?: Date;
  nextSync?: Date;
  error?: string;
  onSyncNow: () => void;
  onForceSync: () => void;
}

export function SyncStatus({ 
  phases, 
  isRunning, 
  lastSync, 
  nextSync, 
  error, 
  onSyncNow, 
  onForceSync 
}: SyncStatusProps) {
  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const totalPhases = phases.length;
  const progress = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

  const getPhaseIcon = (phase: SyncPhase) => {
    switch (phase.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPhaseBadge = (phase: SyncPhase) => {
    switch (phase.status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDuration = (startTime?: Date, endTime?: Date) => {
    if (!startTime) return '';
    const end = endTime || new Date();
    const duration = end.getTime() - startTime.getTime();
    return `${duration}ms`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Google Fit Sync Status</span>
          <div className="flex gap-2">
            <Button 
              onClick={onSyncNow} 
              disabled={isRunning}
              size="sm"
              variant="outline"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isRunning ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button 
              onClick={onForceSync} 
              disabled={isRunning}
              size="sm"
              variant="destructive"
            >
              Force Sync
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          {isRunning ? (
            `Syncing... ${completedPhases}/${totalPhases} phases completed`
          ) : lastSync ? (
            `Last sync: ${lastSync.toLocaleString()}`
          ) : (
            'No recent sync'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-800 font-medium">Sync Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        {/* Sync Phases */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Sync Phases</h4>
          {phases.map((phase, index) => (
            <div key={phase.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getPhaseIcon(phase)}
                <div>
                  <p className="text-sm font-medium">{phase.name}</p>
                  {phase.error && (
                    <p className="text-xs text-red-600 mt-1">{phase.error}</p>
                  )}
                  {phase.startTime && (
                    <p className="text-xs text-gray-500 mt-1">
                      Duration: {formatDuration(phase.startTime, phase.endTime)}
                    </p>
                  )}
                </div>
              </div>
              {getPhaseBadge(phase)}
            </div>
          ))}
        </div>

        {/* Next Sync Info */}
        {nextSync && !isRunning && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-800">
                Next sync: {nextSync.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
