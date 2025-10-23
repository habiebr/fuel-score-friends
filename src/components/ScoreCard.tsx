import { ReactNode, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  title: string;
  score: number;
  maxScore?: number;
  subtitle?: string;
  className?: string;
  variant?: "default" | "success" | "warning" | "info";
  tooltip?: ReactNode;
}

export const ScoreCard = memo(function ScoreCard({ 
  title, 
  score, 
  maxScore = 100, 
  subtitle, 
  className,
  variant = "default",
  tooltip
}: ScoreCardProps) {
  const percentage = (score / maxScore) * 100;
  
  const getScoreColor = () => {
    if (variant === "success" || percentage >= 80) return "text-success";
    if (variant === "warning" || percentage >= 60) return "text-warning";
    if (variant === "info" || percentage >= 40) return "text-info";
    return "text-destructive";
  };

  const getGradientColor = () => {
    if (variant === "success" || percentage >= 80) return "from-success/20 to-success/5";
    if (variant === "warning" || percentage >= 60) return "from-warning/20 to-warning/5";
    if (variant === "info" || percentage >= 40) return "from-info/20 to-info/5";
    return "from-destructive/20 to-destructive/5";
  };

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-card",
      `bg-gradient-to-br ${getGradientColor()}`,
      className
    )}>
      <CardContent className="p-4 sm:p-6">
        <div className="text-center">
          <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 flex items-center justify-center gap-1">
            <span>{title}</span>
            {tooltip && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${title} info`}
                    className="text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-64 text-xs leading-relaxed">
                  <div className="space-y-2">{tooltip}</div>
                </PopoverContent>
              </Popover>
            )}
          </h3>
          <div className={cn("text-2xl sm:text-4xl font-bold mb-1", getScoreColor())}>
            {score}
            {maxScore && <span className="text-sm sm:text-xl text-muted-foreground">/{maxScore}</span>}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        
        {/* Progress indicator */}
        <div className="mt-3 sm:mt-4 bg-muted rounded-full h-1.5 sm:h-2 overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500 rounded-full",
              variant === "success" || percentage >= 80 ? "bg-success" :
              variant === "warning" || percentage >= 60 ? "bg-warning" :
              variant === "info" || percentage >= 40 ? "bg-info" : "bg-destructive"
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
});
