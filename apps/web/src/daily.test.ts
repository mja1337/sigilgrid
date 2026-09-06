import { describe, expect, it } from 'vitest';
import { dailyChallenge, dailySeed, isPreviousDay, visibleDailyStreak } from './daily.ts';

describe('Daily Rift', () => {
  it('builds the same named challenge for everyone on a date', () => {
    const first = dailyChallenge('2026-09-06');
    const second = dailyChallenge('2026-09-06');
    expect(first).toEqual(second);
    expect(first.seed).toBe(20260906);
    expect(first.opponentTemplates).toHaveLength(5);
  });

  it('changes challenge rotation with the date', () => {
    expect(dailySeed('2026-09-06')).not.toBe(dailySeed('2026-09-07'));
    expect(dailyChallenge('2026-09-06')).not.toEqual(dailyChallenge('2026-09-07'));
  });

  it('handles UTC calendar boundaries for streaks', () => {
    expect(isPreviousDay('2026-02-28', '2026-03-01')).toBe(true);
    expect(isPreviousDay('2026-09-05', '2026-09-07')).toBe(false);
    expect(visibleDailyStreak({ streak: 4, lastWinDate: '2026-09-05' }, '2026-09-06')).toBe(4);
    expect(visibleDailyStreak({ streak: 4, lastWinDate: '2026-09-04' }, '2026-09-06')).toBe(0);
  });
});
