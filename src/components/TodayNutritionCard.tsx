import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface MacroData {
  current: number;
  target: number;
  color: string;
}

interface TodayNutritionCardProps {
  calories: {
    current: number;
    target: number;
  };
  protein: MacroData;
  carbs: MacroData;
  fat: MacroData;
  showEducation?: boolean;
}

export function TodayNutritionCard({
  calories,
  protein,
  carbs,
  fat,
  showEducation = false,
}: TodayNutritionCardProps) {
  const [openTip, setOpenTip] = useState<null | "Calories" | "Protein" | "Carbs" | "Fat">(null);

  const caloriePercentage = useMemo(() => {
    if (!calories.target) return 0;
    return Math.min(Math.round((calories.current / calories.target) * 100), 999);
  }, [calories]);

  const tips: Record<"Protein" | "Carbs" | "Fat", { title: string; points: string[]; target: string }> = {
    Protein: {
      title: "Why protein builds your runs:",
      points: [
        "Repairs muscle micro-tears from training",
        "Supports recovery and adaptation",
        "Helps maintain lean mass during hard cycles",
        "Improves satiety and stable energy",
      ],
      target: "Target: 1.2–1.6g per kg body weight",
    },
    Carbs: {
      title: "Why carbs fuel your runs:",
      points: [
        "Primary fuel for moderate–high intensity",
        "Replenishes muscle glycogen stores",
        "Supports brain function on long efforts",
        "Speeds post‑workout recovery",
      ],
      target: "Target: 5–10g per kg body weight (by training load)",
    },
    Fat: {
      title: "Why healthy fats matter:",
      points: [
        "Fuel source for long, easier runs",
        "Reduces training inflammation",
        "Supports hormone production",
        "Aids absorption of fat‑soluble vitamins",
      ],
      target: "Target: 20–35% of total calories",
    },
  };

  const macroConfig = [
    { key: "Protein" as const, data: protein, label: "Protein", unit: "g" },
    { key: "Carbs" as const, data: carbs, label: "Carbs", unit: "g" },
    { key: "Fat" as const, data: fat, label: "Fats", unit: "g" },
  ];

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-primary/20 opacity-60" />
      <CardContent className="relative space-y-8 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Nutrition</h3>
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              Today&apos;s fuel status
            </p>
          </div>
          <div className="rounded-full bg-primary/20 px-3 py-1 text-sm font-semibold text-primary shadow-[0_0_18px_rgba(49,255,176,0.35)]">
            {caloriePercentage}%
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <GlowRing
            value={calories.current}
            target={calories.target}
            size={160}
            strokeWidth={18}
            color="#FFD74A"
            centerLabel={`${Math.round(calories.current)}`}
            centerSubLabel="KCAL"
            subText={`of ${Math.round(calories.target)} target`}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Goal − Food + Exercise = Remaining</span>
            {showEducation && (
              <button
                aria-label="Calories info"
                onClick={() => setOpenTip(openTip === "Calories" ? null : "Calories")}
                className="rounded-full border border-border/50 bg-background/60 p-1 text-muted-foreground hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {showEducation && openTip === "Calories" && (
            <InfoPanel className="max-w-sm text-center">
              <div className="text-sm font-semibold">Calorie math</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(calories.target)} − {Math.round(calories.current)} + 0 ={" "}
                <span className="font-semibold text-primary">
                  {Math.max(0, Math.round(calories.target - calories.current))}
                </span>{" "}
                kcal remaining
              </p>
            </InfoPanel>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {macroConfig.map(({ key, data, label, unit }) => {
            const remaining = Math.max(0, data.target - data.current);
            const percent = data.target ? Math.round((data.current / data.target) * 100) : 0;
            return (
              <div key={key} className="flex flex-col items-center gap-2">
                <GlowRing
                  value={data.current}
                  target={data.target}
                  size={104}
                  strokeWidth={14}
                  color={data.color}
                  centerLabel={`${Math.round(data.current)}${unit}`}
                  centerSubLabel=""
                />
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                      "bg-background/70 text-foreground border border-border/40 shadow-[0_0_20px_rgba(49,255,176,0.18)]",
                    )}
                    style={{ borderColor: `${hexToRgba(data.color, 0.4)}` }}
                  >
                    {label}
                  </span>
                  {showEducation && (
                    <button
                      aria-label={`${label} info`}
                      onClick={() => setOpenTip(openTip === key ? null : key)}
                      className="rounded-full border border-border/50 bg-background/60 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(data.target)}{unit} target • {remaining}{unit} left
                </div>
                {showEducation && openTip === key && (
                  <InfoPanel>
                    <div className="text-sm font-semibold text-foreground">{tips[key].title}</div>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {tips[key].points.map((point) => (
                        <li key={point}>• {point}</li>
                      ))}
                    </ul>
                    <div className="mt-2 text-xs font-medium text-primary">{tips[key].target}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Intake today: <span className="font-semibold">{percent}%</span>
                    </div>
                  </InfoPanel>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface GlowRingProps {
  value: number;
  target: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  subText?: string;
}

function GlowRing({
  value,
  target,
  color,
  size = 140,
  strokeWidth = 16,
  centerLabel,
  centerSubLabel,
  subText,
}: GlowRingProps) {
  const progress = target > 0 ? Math.min(value / target, 1) : 0;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - progress * circumference;

  const glow = hexToRgba(color, 0.45);
  const track = "rgba(255,255,255,0.08)";
  const label = centerLabel ?? `${Math.round(value)}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${hexToRgba(color, 0.35)}, transparent 70%)` }}
        />
        <svg width={size} height={size} className="absolute inset-0">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={track}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 18px ${glow})` }}
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-4 text-center">
          <div className="text-3xl font-semibold leading-none md:text-4xl">{label}</div>
          {centerSubLabel && (
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{centerSubLabel}</div>
          )}
        </div>
      </div>
      {subText && <div className="text-sm text-muted-foreground">{subText}</div>}
    </div>
  );
}

function InfoPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border/40 bg-background/80 p-4 text-left text-xs shadow-[0_20px_45px_rgba(5,10,20,0.45)] backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) return hex;
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
