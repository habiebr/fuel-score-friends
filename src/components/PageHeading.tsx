import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeadingProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeading({
  title,
  description,
  eyebrow,
  actions,
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
