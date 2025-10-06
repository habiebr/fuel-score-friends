import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, Zap, Droplets, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Insight {
  icon: 'zap' | 'droplets' | 'info';
  title: string;
  message: string;
  color: string;
  details?: string[];
}

interface TodayInsightsCardProps {
  insights: Insight[];
}

export function TodayInsightsCard({ insights }: TodayInsightsCardProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'zap': return Zap;
      case 'droplets': return Droplets;
      default: return Info;
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-base">Today's Insights</h3>
        </div>

        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = getIcon(insight.icon);
            const isExpanded = expandedIndex === index;
            const hasDetails = insight.details && insight.details.length > 0;

            return (
              <div
                key={index}
                className={`rounded-lg p-3 transition-all ${insight.color} ${hasDetails ? 'cursor-pointer' : ''}`}
                onClick={() => hasDetails && toggleExpand(index)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    insight.icon === 'zap' ? 'bg-blue-500' : 
                    insight.icon === 'droplets' ? 'bg-green-500' : 
                    'bg-purple-500'
                  }`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1">{insight.title}</div>
                    <div className="text-sm leading-relaxed">{insight.message}</div>
                    
                    {isExpanded && hasDetails && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <ul className="space-y-2 text-sm">
                          {insight.details!.map((detail, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-gray-400 mt-1">•</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {hasDetails && (
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

