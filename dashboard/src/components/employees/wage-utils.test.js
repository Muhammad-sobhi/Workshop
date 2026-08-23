import { describe, it, expect } from 'vitest';
import {
  applyWorkModeChange,
  computeDayWage,
  computeRowTotals,
  computeWeekSummary,
} from './wage-utils';

const RATE = 200;

describe('applyWorkModeChange', () => {
  const baseRow = { daily_wage: 999, product_id: 'p1', quantity: '5', piece_rate: '10' };

  it('full_day sets daily_wage to rate and clears piece fields', () => {
    const next = applyWorkModeChange(baseRow, 'full_day', RATE);
    expect(next.daily_wage).toBe(RATE);
    expect(next.product_id).toBe('');
    expect(next.quantity).toBe('');
    expect(next.piece_rate).toBe('');
  });

  it('half_day sets daily_wage to rate/2 and clears piece fields', () => {
    const next = applyWorkModeChange(baseRow, 'half_day', RATE);
    expect(next.daily_wage).toBe(RATE / 2);
    expect(next.product_id).toBe('');
    expect(next.quantity).toBe('');
    expect(next.piece_rate).toBe('');
  });

  it('piece_rate zeroes daily_wage but preserves piece fields', () => {
    const next = applyWorkModeChange(baseRow, 'piece_rate', RATE);
    expect(next.daily_wage).toBe(0);
    expect(next.product_id).toBe('p1');
    expect(next.quantity).toBe('5');
    expect(next.piece_rate).toBe('10');
  });

  it('hybrid keeps an existing truthy daily_wage', () => {
    const next = applyWorkModeChange(baseRow, 'hybrid', RATE);
    expect(next.daily_wage).toBe(999);
  });

  it('hybrid falls back to rate when daily_wage is falsy', () => {
    const next = applyWorkModeChange({ ...baseRow, daily_wage: 0 }, 'hybrid', RATE);
    expect(next.daily_wage).toBe(RATE);
  });

  it.each(['leave', 'absent'])('%s zeroes daily_wage and clears piece fields', (mode) => {
    const next = applyWorkModeChange(baseRow, mode, RATE);
    expect(next.daily_wage).toBe(0);
    expect(next.product_id).toBe('');
    expect(next.quantity).toBe('');
    expect(next.piece_rate).toBe('');
  });

  it('treats missing/undefined rate as 0 (rate || 0)', () => {
    expect(applyWorkModeChange({ daily_wage: 50 }, 'full_day', undefined).daily_wage).toBe(0);
    expect(applyWorkModeChange({ daily_wage: 50 }, 'half_day', 0).daily_wage).toBe(0);
  });

  it('does not mutate the input row', () => {
    const original = { ...baseRow };
    applyWorkModeChange(baseRow, 'leave', RATE);
    expect(baseRow).toEqual(original);
  });
});

describe('computeDayWage', () => {
  it.each([
    ['full_day', { dailyWage: RATE, pieceWage: 0 }],
    ['half_day', { dailyWage: RATE / 2, pieceWage: 0 }],
    ['piece_rate', { dailyWage: 0, pieceWage: 500 }],
    ['hybrid', { dailyWage: RATE, pieceWage: 500 }],
    ['leave', { dailyWage: 0, pieceWage: 0 }],
    ['absent', { dailyWage: 0, pieceWage: 0 }],
  ])('%s with rate=%d quantity=50 pieceRate=10 → %j', (workMode, expected) => {
    expect(computeDayWage({ workMode, rate: RATE, quantity: '50', pieceRate: '10' })).toEqual(expected);
  });

  it('ignores piece inputs in modes that do not honor them', () => {
    expect(computeDayWage({ workMode: 'full_day', rate: RATE, quantity: '50', pieceRate: '10' }).pieceWage).toBe(0);
    expect(computeDayWage({ workMode: 'leave', rate: RATE, quantity: '50', pieceRate: '10' }).pieceWage).toBe(0);
  });

  it('handles zero rate / zero quantity / zero piece rate', () => {
    expect(computeDayWage({ workMode: 'hybrid', rate: 0, quantity: '0', pieceRate: '10' })).toEqual({
      dailyWage: 0,
      pieceWage: 0,
    });
    expect(computeDayWage({ workMode: 'piece_rate', rate: 100, quantity: '', pieceRate: '' })).toEqual({
      dailyWage: 0,
      pieceWage: 0,
    });
  });

  it('coerces numeric strings', () => {
    expect(computeDayWage({ workMode: 'half_day', rate: '300' }).dailyWage).toBe(150);
  });
});

describe('computeRowTotals', () => {
  it('computes pieceTotal and net for a full row', () => {
    expect(
      computeRowTotals({
        daily_wage: 200,
        quantity: '10',
        piece_rate: '5',
        advance_amount: 30,
        penalty_amount: 20,
      })
    ).toEqual({ pieceTotal: 50, net: 200 });
  });

  it('can go negative after advances and penalties exceed gross', () => {
    expect(
      computeRowTotals({
        daily_wage: 100,
        quantity: '',
        piece_rate: '',
        advance_amount: 150,
        penalty_amount: 25,
      }).net
    ).toBe(-75);
  });

  it('coerces empty strings / nulls to 0', () => {
    expect(
      computeRowTotals({
        daily_wage: '',
        quantity: null,
        piece_rate: null,
        advance_amount: '',
        penalty_amount: undefined,
      })
    ).toEqual({ pieceTotal: 0, net: 0 });
  });
});

describe('computeWeekSummary', () => {
  it('aggregates totals, gross, and netPayable across days', () => {
    const days = [
      { daily_wage: 200, quantity: '', piece_rate: '', advance_amount: 50, penalty_amount: 0 },
      { daily_wage: 100, quantity: '10', piece_rate: '5', advance_amount: 0, penalty_amount: 20 },
      { daily_wage: 0, quantity: '4', piece_rate: '7.5', advance_amount: 10, penalty_amount: 0 },
    ];
    expect(computeWeekSummary(days)).toEqual({
      totalDailyWage: 300,
      totalPieceWage: 80,
      grossTotal: 380,
      totalAdvances: 60,
      totalPenalties: 20,
      netPayable: 300,
    });
  });

  it('returns all zeros for an empty week', () => {
    expect(computeWeekSummary([])).toEqual({
      totalDailyWage: 0,
      totalPieceWage: 0,
      grossTotal: 0,
      totalAdvances: 0,
      totalPenalties: 0,
      netPayable: 0,
    });
  });

  it('netPayable can be negative when deductions dominate', () => {
    const days = [
      { daily_wage: 50, quantity: '', piece_rate: '', advance_amount: 100, penalty_amount: 0 },
    ];
    expect(computeWeekSummary(days).netPayable).toBe(-50);
  });
});
