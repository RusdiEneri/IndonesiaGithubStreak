import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStreaks } from './streak.js';

test('calculates longest and current streak', () => {
  const days = [
    { date: '2026-09-17', contributionCount: 2 },
    { date: '2026-09-18', contributionCount: 1 },
    { date: '2026-09-19', contributionCount: 1 },
    { date: '2026-09-20', contributionCount: 0 },
    { date: '2026-09-21', contributionCount: 3 },
    { date: '2026-09-22', contributionCount: 5 },
    { date: '2026-09-23', contributionCount: 2 }
  ];

  assert.deepEqual(calculateStreaks(days, '2026-09-23'), {
    longestStreak: 3,
    currentStreak: 3
  });
});

test('current streak is zero when today has no contribution', () => {
  const days = [
    { date: '2026-09-21', contributionCount: 1 },
    { date: '2026-09-22', contributionCount: 1 },
    { date: '2026-09-23', contributionCount: 0 }
  ];

  assert.deepEqual(calculateStreaks(days, '2026-09-23'), {
    longestStreak: 2,
    currentStreak: 0
  });
});
