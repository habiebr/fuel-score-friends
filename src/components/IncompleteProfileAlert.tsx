import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, User, Scale, Ruler, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface IncompleteProfileAlertProps {
  missingData?: string[];
  hasBodyMetrics?: boolean;
  hasMealPlan?: boolean;
  hasFoodLogs?: boolean;
  mealsLogged?: number;
  className?: string;
}

export function IncompleteProfileAlert({
  missingData = [],
  hasBodyMetrics = false,
  hasMealPlan = false,
  hasFoodLogs = false,
  mealsLogged = 0,
  className = '',
}: IncompleteProfileAlertProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Don't show if everything is complete
  // NOTE: Meal plan is NOT required since science layer can calculate targets!
  if (hasBodyMetrics && hasFoodLogs && mealsLogged > 0) {
    return null;
  }

  const getMissingFieldIcon = (field: string) => {
    if (field.includes('weight')) return <Scale className="h-4 w-4" />;
    if (field.includes('height')) return <Ruler className="h-4 w-4" />;
    if (field.includes('age')) return <Calendar className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  const getSeverity = () => {
    if (!hasBodyMetrics) return 'critical';
    if (!hasFoodLogs) return 'medium';
    return 'low';
  };

  const severity = getSeverity();

  const severityConfig = {
    critical: {
      variant: 'destructive' as const,
      title: t('alerts.profileIncomplete'),
      description: t('alerts.profileIncompleteMessage'),
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive',
    },
    medium: {
      variant: 'default' as const,
      title: t('alerts.noMealsLogged'),
      description: t('alerts.noMealsLoggedMessage'),
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500',
    },
    low: {
      variant: 'default' as const,
      title: t('alerts.limitedData'),
      description: t('alerts.limitedDataMessage'),
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500',
    },
  };

  const config = severityConfig[severity];

  return (
    <Alert variant={config.variant} className={`${config.bgColor} ${config.borderColor} ${className}`}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription>
        <p className="mb-3">{config.description}</p>
        
        {!hasBodyMetrics && missingData.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="font-semibold text-sm">{t('alerts.missingRequiredInfo')}</p>
            <ul className="space-y-1">
              {missingData.map((field, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  {getMissingFieldIcon(field)}
                  <span className="capitalize">{field}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasBodyMetrics && (
          <Button
            size="sm"
            onClick={() => navigate('/settings')}
            className="mt-2"
          >
            <User className="h-4 w-4 mr-2" />
            {t('alerts.completeYourProfile')}
          </Button>
        )}

        {hasBodyMetrics && !hasFoodLogs && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/food-log')}
            className="mt-2"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {t('alerts.logYourFirstMeal')}
          </Button>
        )}

        {hasBodyMetrics && hasFoodLogs && mealsLogged === 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {t('alerts.tipLogMeals')}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface DataCompletenessScoreDisplayProps {
  score: number;
  hasBodyMetrics: boolean;
  hasFoodLogs: boolean;
  mealsLogged: number;
  reliable: boolean;
  missingData?: string[];
}

export function DataCompletenessScoreDisplay({
  score,
  hasBodyMetrics,
  hasFoodLogs,
  mealsLogged,
  reliable,
  missingData = [],
}: DataCompletenessScoreDisplayProps) {
  if (reliable) {
    // Show normal score if data is complete and reliable
    return (
      <div className="flex flex-col items-center">
        <div className="text-5xl font-bold text-primary">{score}</div>
        <div className="text-sm text-muted-foreground">/ 100</div>
      </div>
    );
  }

  if (!hasBodyMetrics) {
    // Show placeholder if body metrics missing
    return (
      <div className="flex flex-col items-center">
        <div className="text-5xl font-bold text-muted-foreground">--</div>
        <div className="text-xs text-destructive font-medium">{t('alerts.profileIncompleteShort')}</div>
      </div>
    );
  }

  // Show score with warning if data is incomplete but we have body metrics
  return (
    <div className="flex flex-col items-center relative">
      <div className="text-5xl font-bold text-orange-500">{score}</div>
      <div className="text-xs text-orange-600 font-medium flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {t('alerts.incompleteData')}
      </div>
    </div>
  );
}
