import { describe, it, expect } from 'vitest';
import { dailyScore, weeklyScore } from '@/science/dailyScore';

describe('dailyScore', () => {
  it('rest day → nutrition only, timing 100, no snack', () => {
    const score = dailyScore({
      load: 'rest',
      nutrition: {
        target: { cho: 250, protein: 120, fat: 60 },
        actual: { cho: 250, protein: 120, fat: 60 },
        windows: { pre: { applicable: false, inWindow: false }, during: { applicable: false }, post: { applicable: false, inWindow: false } },
        mealsPresent: ['breakfast','lunch','dinner'],
      },
      training: {},
    } as any);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('long day well fueled & completed → high score', () => {
    const score = dailyScore({
      load: 'long',
      nutrition: {
        target: { cho: 500, protein: 130, fat: 70, preCho: 100, duringChoPerHour: 60, postCho: 80, postPro: 20 },
        actual: { cho: 500, protein: 130, fat: 70, preCho: 100, duringChoPerHour: 60, postCho: 80, postPro: 20 },
        windows: { pre: { applicable: true, inWindow: true }, during: { applicable: true }, post: { applicable: true, inWindow: true } },
        mealsPresent: ['breakfast','lunch','dinner','snack'],
      },
      training: { plan: { durationMin: 100 }, actual: { durationMin: 100 }, typeFamilyMatch: true, intensityOk: true },
    } as any);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('quality day underfueled CHO and late post → penalties applied', () => {
    const score = dailyScore({
      load: 'quality',
      nutrition: {
        target: { cho: 480, protein: 120, fat: 70, preCho: 80, duringChoPerHour: 0, postCho: 70, postPro: 20 },
        actual: { cho: 350, protein: 120, fat: 70, preCho: 80, duringChoPerHour: 0, postCho: 30, postPro: 10 },
        windows: { pre: { applicable: true, inWindow: true }, during: { applicable: false }, post: { applicable: true, inWindow: false } },
        mealsPresent: ['breakfast','lunch','dinner'],
        singleMealOver60pct: false,
      },
      training: { plan: { durationMin: 70 }, actual: { durationMin: 70 }, typeFamilyMatch: true, intensityNear: true },
      flags: { isHardDay: true, missedPostWindow: true },
    } as any);
    expect(score).toBeLessThan(80);
  });
});

describe('weeklyScore', () => {
  it('sums seven daily scores', () => {
    const total = weeklyScore([100, 90, 80, 70, 60, 50, 40]);
    expect(total).toBe(490);
  });
});


