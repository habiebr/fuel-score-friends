export type Load = 'rest'|'easy'|'moderate'|'long'|'quality';

export function weeklyScore(scores: number[]): number {
  return scores.slice(0, 7).reduce((s, v) => s + Math.max(0, Math.min(100, Math.round(v))), 0);
}

export function dailyScore(ctx: {
  load: Load;
  nutrition: {
    target: { cho:number; protein:number; fat:number; preCho?:number; duringChoPerHour?:number; postCho?:number; postPro?:number; fatMin?:number };
    actual: { cho:number; protein:number; fat:number; preCho?:number; duringChoPerHour?:number; postCho?:number; postPro?:number };
    windows: {
      pre: { applicable:boolean; inWindow:boolean };
      during: { applicable:boolean };
      post: { applicable:boolean; inWindow:boolean };
    };
    mealsPresent: ('breakfast'|'lunch'|'dinner'|'snack')[];
    singleMealOver60pct?: boolean;
  };
  training: {
    plan?: { durationMin?:number; type?:string; intensity?:number };
    actual?: { durationMin?:number; type?:string; avgHr?:number };
    typeFamilyMatch?: boolean;
    intensityOk?: boolean;
    intensityNear?: boolean;
  };
  flags?: {
    windowSyncAll?: boolean;
    streakDays?: number;
    hydrationOk?: boolean;
    bigDeficit?: boolean;
    isHardDay?: boolean;
    missedPostWindow?: boolean;
  };
}): number {
  const load = ctx.load;
  const NWEIGHTS: Record<Load, { wN:number; wT:number }> = {
    rest: { wN: 1.0, wT: 0.0 },
    easy: { wN: 0.7, wT: 0.3 },
    moderate: { wN: 0.6, wT: 0.4 },
    long: { wN: 0.55, wT: 0.45 },
    quality: { wN: 0.6, wT: 0.4 },
  };

  // ---- Nutrition ----
  const { target, actual, windows, mealsPresent, singleMealOver60pct } = ctx.nutrition;
  const fatMin = target.fatMin ?? Math.round((target.fat * 0.2)); // fallback if not provided

  // Macros piecewise score helper
  function piecewiseScore(errPctAbs: number): number {
    if (errPctAbs <= 0.05) return 100;
    if (errPctAbs <= 0.10) return 60;
    if (errPctAbs <= 0.20) return 20;
    return 0;
  }

  const choErr = target.cho > 0 ? Math.abs((actual.cho - target.cho) / target.cho) : 0;
  const proErr = target.protein > 0 ? Math.abs((actual.protein - target.protein) / target.protein) : 0;
  const fatErr = target.fat > 0 ? Math.abs((actual.fat - target.fat) / target.fat) : 0;
  // If fat below minimum kcal share, fat score is 0
  const fatBelowMin = actual.fat < fatMin;
  const macroChoScore = piecewiseScore(choErr);
  const macroProScore = piecewiseScore(proErr);
  const macroFatScore = fatBelowMin ? 0 : piecewiseScore(fatErr);
  const macrosScore = macroChoScore * 0.5 + macroProScore * 0.3 + macroFatScore * 0.2;

  // Timing
  let timingPre = 100;
  if (windows.pre.applicable) {
    const need = (target.preCho ?? 0) * 0.8;
    const ok = windows.pre.inWindow && (actual.preCho ?? 0) >= need && need > 0;
    timingPre = ok ? 100 : 0;
  }

  let timingDuring = 100;
  if (windows.during.applicable) {
    const need = target.duringChoPerHour ?? 0;
    const got = actual.duringChoPerHour ?? 0;
    const delta = Math.abs(got - need);
    // ±10 -> 100, ±30 -> 0 (linear)
    if (need <= 0) {
      timingDuring = 100;
    } else if (delta >= 30) {
      timingDuring = 0;
    } else if (delta <= 10) {
      timingDuring = 100;
    } else {
      // map 10..30 to 100..0
      timingDuring = Math.round(100 * (1 - (delta - 10) / 20));
    }
  }

  let timingPost = 100;
  if (windows.post.applicable) {
    const needCho = (target.postCho ?? 0) * 0.8;
    const needPro = (target.postPro ?? 0) * 0.8;
    const gotCho = actual.postCho ?? 0;
    const gotPro = actual.postPro ?? 0;
    const ok = windows.post.inWindow && (gotCho >= needCho) && (gotPro >= needPro) && (needCho + needPro > 0);
    timingPost = ok ? 100 : 0;
  }

  const timingScore = timingPre * 0.4 + timingDuring * 0.4 + timingPost * 0.2;

  // Structure
  const needSnack = windows.during.applicable || load !== 'rest';
  let structureScore = 0;
  const hasB = mealsPresent.includes('breakfast');
  const hasL = mealsPresent.includes('lunch');
  const hasD = mealsPresent.includes('dinner');
  const hasS = mealsPresent.includes('snack');
  structureScore += hasB ? 25 : 0;
  structureScore += hasL ? 25 : 0;
  structureScore += hasD ? 25 : 0;
  if (needSnack) structureScore += hasS ? 25 : 0;
  if (singleMealOver60pct) structureScore = Math.min(structureScore, 70);

  const nutritionScore = (macrosScore * 0.50) + (timingScore * 0.35) + (structureScore * 0.15);

  // ---- Training ----
  // Completion
  let completionScore = 100;
  const planned = ctx.training.plan?.durationMin ?? 0;
  const actualDur = ctx.training.actual?.durationMin ?? 0;
  if (planned > 0 || actualDur > 0) {
    const ratio = planned > 0 ? actualDur / planned : 1;
    if (ratio >= 0.9 && ratio <= 1.1) completionScore = 100;
    else if (ratio >= 0.75 && ratio <= 1.25) completionScore = 60;
    else completionScore = 0;
  }

  // Type match
  const typeMatchScore = (ctx.training.typeFamilyMatch ?? false) ? 100 : 0;

  // Intensity
  let intensityScore = 0;
  if (ctx.training.intensityOk) intensityScore = 100;
  else if (ctx.training.intensityNear) intensityScore = 60;
  else intensityScore = 0;
  // If HR missing, fold its weight into completion per spec
  const intensityWeight = (ctx.training.actual?.avgHr ?? undefined) ? 0.15 : 0;
  const completionWeight = 0.60 + (0.15 - intensityWeight);
  const trainingScore = (completionScore * completionWeight) + (typeMatchScore * 0.25) + (intensityScore * intensityWeight);

  // ---- Bonuses & Penalties ----
  let bonus = 0;
  if (ctx.flags?.windowSyncAll) bonus += 5;
  if (ctx.flags?.streakDays && ctx.flags.streakDays > 0) bonus += Math.min(5, ctx.flags.streakDays);
  if (ctx.flags?.hydrationOk) bonus += 2;
  bonus = Math.min(10, bonus);

  let penalty = 0;
  const hardUnderfuel = (ctx.flags?.isHardDay && actual.cho < (target.cho * 0.8));
  if (hardUnderfuel) penalty -= 5;
  if (ctx.flags?.bigDeficit && (actualDur >= 90)) penalty -= 10;
  if (ctx.flags?.missedPostWindow) penalty -= 3;
  penalty = Math.max(-15, penalty);

  // Weights by load
  const { wN, wT } = NWEIGHTS[load];
  let final = (nutritionScore * wN) + (trainingScore * wT) + bonus + penalty;
  return Math.max(0, Math.min(100, Math.round(final)));
}


