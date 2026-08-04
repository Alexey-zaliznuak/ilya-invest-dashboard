import { requireElement, setText, toggleSignClass } from '../lib/dom';
import { dash, fmt, formatPeriod, orDash, percent, pluralize, signed } from '../lib/format';
import { START_CAPITAL } from '../lib/compute';
import type { Metrics } from '../lib/types';

/** Сумма ROE — это проценты без реинвестирования, поэтому подписываем их пунктами. */
const points = (value: number): string => `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value))} п.п.`;

function setBarWidth(selector: string, gain: number, maxGain: number): void {
  const width = maxGain === 0 ? 0 : (Math.abs(gain) / maxGain) * 100;
  requireElement<HTMLElement>(selector).style.width = `${width.toFixed(1)}%`;
}

export function renderSummary(metrics: Metrics): void {
  const fixations = pluralize(metrics.count, ['фиксации', 'фиксаций', 'фиксаций']);
  setText('#heroEyebrow', `Капитал после ${metrics.count} ${fixations}`);
  setText('#heroCapital', fmt(metrics.finalCapital, 2));
  setText('#heroReturn', signed(metrics.netReturn, 2));
  toggleSignClass('#heroReturn', metrics.netReturn);
  setText('#heroPeak', percent(metrics.peakCapital, 2));
  setText('#heroWins', String(metrics.wins));
  setText('#heroLosses', String(metrics.losses));

  setText('#cardRoeSum', points(metrics.roeSum));
  setText('#cardCompound', signed(metrics.netReturn));
  toggleSignClass('#cardCompound', metrics.netReturn);
  setText('#cardDrawdown', signed(metrics.maxDrawdown));
  setText('#cardWinRate', orDash(metrics.winRate, (value) => percent(value, 2)));
  setText(
    '#cardWinRateNote',
    `${metrics.wins} из ${metrics.count} ${pluralize(metrics.count, ['фиксации', 'фиксаций', 'фиксаций'])}`,
  );
  setText('#cardMedian', orDash(metrics.medianRoe, (value) => signed(value)));
  setText('#cardCount', String(metrics.count));

  setText('#statAvg', orDash(metrics.avgRoe, (value) => signed(value)));
  setText('#statAvgWin', orDash(metrics.avgWin, (value) => signed(value)));
  setText('#statAvgLoss', orDash(metrics.avgLoss, (value) => signed(value)));
  setText('#statBest', orDash(metrics.bestRoe, (value) => signed(value)));
  setText('#statWorst', orDash(metrics.worstRoe, (value) => signed(value)));
  setText('#statPeak', percent(metrics.peakBeforeDrawdown));

  setText('#compareSimple', percent(metrics.simpleTotal));
  setText('#compareCompound', percent(metrics.finalCapital));
  const simpleGain = metrics.simpleTotal - START_CAPITAL;
  const compoundGain = metrics.finalCapital - START_CAPITAL;
  const maxGain = Math.max(Math.abs(simpleGain), Math.abs(compoundGain));
  setBarWidth('#barSimple', simpleGain, maxGain);
  setBarWidth('#barCompound', compoundGain, maxGain);

  setText(
    '#rangeLabel',
    metrics.count === 0
      ? dash
      : `${fmt(START_CAPITAL, 2)} → ${fmt(metrics.finalCapital, 2)}`,
  );
  setText('#periodLabel', formatPeriod(metrics.firstDate, metrics.lastDate));
}
