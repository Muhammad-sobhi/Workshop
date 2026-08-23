/**
 * Pure wage-calculation helpers extracted from WeeklyTimesheetGrid.jsx.
 * Behavior must remain identical to the original inline logic.
 */

/** Apply the work_mode switch behavior from handleFieldChange. */
export function applyWorkModeChange(row, workMode, rate = 0) {
  const next = { ...row };

  if (workMode === 'full_day') {
    next.daily_wage = rate || 0;
    next.product_id = '';
    next.quantity = '';
    next.piece_rate = '';
  } else if (workMode === 'half_day') {
    next.daily_wage = (rate || 0) / 2;
    next.product_id = '';
    next.quantity = '';
    next.piece_rate = '';
  } else if (workMode === 'piece_rate') {
    next.daily_wage = 0;
  } else if (workMode === 'hybrid') {
    next.daily_wage = next.daily_wage || rate || 0;
  } else if (workMode === 'leave' || workMode === 'absent') {
    next.daily_wage = 0;
    next.product_id = '';
    next.quantity = '';
    next.piece_rate = '';
  }

  return next;
}

/**
 * Gross day wage broken down by component, mirroring the grid's behavior:
 * piece inputs are only honored in piece_rate/hybrid modes; leave/absent pay nothing.
 */
export function computeDayWage({ workMode, rate, quantity, pieceRate }) {
  const q = Number(quantity) || 0;
  const pr = Number(pieceRate) || 0;

  switch (workMode) {
    case 'full_day':
      return { dailyWage: rate || 0, pieceWage: 0 };
    case 'half_day':
      return { dailyWage: (rate || 0) / 2, pieceWage: 0 };
    case 'piece_rate':
      return { dailyWage: 0, pieceWage: q * pr };
    case 'hybrid':
      return { dailyWage: rate || 0, pieceWage: q * pr };
    case 'leave':
    case 'absent':
      return { dailyWage: 0, pieceWage: 0 };
    default:
      return { dailyWage: 0, pieceWage: 0 };
  }
}

/** Per-row piece total and net, identical to the table/card row math. */
export function computeRowTotals(day) {
  const pieceTotal =
    (Number(day.quantity) || 0) * (Number(day.piece_rate) || 0);
  const net =
    (Number(day.daily_wage) || 0) +
    pieceTotal -
    (Number(day.advance_amount) || 0) -
    (Number(day.penalty_amount) || 0);

  return { pieceTotal, net };
}

/** Week summary, identical to the summary useMemo in WeeklyTimesheetGrid. */
export function computeWeekSummary(days) {
  let totalDailyWage = 0;
  let totalPieceWage = 0;
  let totalAdvances = 0;
  let totalPenalties = 0;

  days.forEach((day) => {
    const daily = Number(day.daily_wage) || 0;
    const q = Number(day.quantity) || 0;
    const pr = Number(day.piece_rate) || 0;
    const pieceTotal = q * pr;
    const adv = Number(day.advance_amount) || 0;
    const pen = Number(day.penalty_amount) || 0;

    totalDailyWage += daily;
    totalPieceWage += pieceTotal;
    totalAdvances += adv;
    totalPenalties += pen;
  });

  const grossTotal = totalDailyWage + totalPieceWage;
  const netPayable = grossTotal - totalAdvances - totalPenalties;

  return { totalDailyWage, totalPieceWage, grossTotal, totalAdvances, totalPenalties, netPayable };
}
