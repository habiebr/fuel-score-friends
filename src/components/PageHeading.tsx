import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PageHeadingProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function PageHeading({
  title,
  description,
  eyebrow,
  actions,
  icon: Icon,
  className,
}: PageHeadingProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            {eyebrow}
          </span>
        )}
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
