import { START_CAPITAL } from '../lib/compute';
import { escapeHtml } from '../lib/dom';
import { fmt, formatDate, formatShortDate, signed } from '../lib/format';
import type { ComputedTrade } from '../lib/types';

const PADDING = { left: 54, right: 20, top: 20, bottom: 38 };
const VALUE_TICKS = 5;
const AXIS_LABELS = 4;

interface ChartPoint {
  after: number;
  axisLabel: string;
  tooltip: string;
}

const startPoint: ChartPoint = {
  after: START_CAPITAL,
  axisLabel: 'Старт',
  tooltip: `<strong>Старт</strong>Капитал: ${fmt(START_CAPITAL)}%`,
};

const toPoint = (row: ComputedTrade): ChartPoint => ({
  after: row.after,
  // Без даты подписываем номером фиксации — иначе на оси появится пустое место.
  axisLabel: row.tradeDate ? formatShortDate(row.tradeDate) : `#${row.index + 1}`,
  tooltip:
    `<strong>#${escapeHtml(row.ticker)}${row.title ? ` · ${escapeHtml(row.title)}` : ''}</strong>` +
    `<span class="${row.roe >= 0 ? 'positive' : 'negative'}">ROE: ${signed(row.roe)}</span><br>` +
    `Вклад: ${signed(row.contribution)}<br>Капитал: ${fmt(row.after)}%` +
    (row.tradeDate ? `<br><span class="muted">${formatDate(row.tradeDate)}</span>` : ''),
});

export interface EquityChart {
  setData(series: ComputedTrade[]): void;
  redraw(): void;
  destroy(): void;
}

const chartContainer = (svg: SVGSVGElement): HTMLElement => {
  const wrap = svg.parentElement;
  if (!wrap) throw new Error('График должен лежать внутри контейнера');
  return wrap;
};

export function createEquityChart(svg: SVGSVGElement, tooltip: HTMLElement): EquityChart {
  const wrap = chartContainer(svg);

  let points: ChartPoint[] = [];
  let detachPointer: (() => void) | null = null;

  const hideTooltip = () => {
    tooltip.style.display = 'none';
  };

  function drawPlaceholder(): void {
    svg.removeAttribute('viewBox');
    svg.innerHTML = `<text x="50%" y="50%" fill="var(--g-color-text-hint)" font-size="13" text-anchor="middle">Недостаточно данных для графика</text>`;
  }

  function draw(): void {
    detachPointer?.();
    detachPointer = null;
    hideTooltip();

    if (points.length < 2) {
      drawPlaceholder();
      return;
    }

    const width = Math.max(320, wrap.clientWidth - 20);
    const height = Math.max(260, wrap.clientHeight - 16);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const values = points.map((point) => point.after);
    const min = Math.floor((Math.min(...values) - 8) / 10) * 10;
    const max = Math.ceil((Math.max(...values) + 8) / 10) * 10;
    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;

    const toX = (index: number) => PADDING.left + (index * plotWidth) / (points.length - 1);
    const toY = (value: number) => PADDING.top + ((max - value) * plotHeight) / (max - min);

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(index).toFixed(2)} ${toY(point.after).toFixed(2)}`)
      .join(' ');
    const area = `${line} L ${toX(points.length - 1)} ${height - PADDING.bottom} L ${toX(0)} ${height - PADDING.bottom} Z`;

    let grid = '';
    for (let index = 0; index <= VALUE_TICKS; index += 1) {
      const value = min + ((max - min) * index) / VALUE_TICKS;
      const y = toY(value);
      grid +=
        `<line x1="${PADDING.left}" y1="${y}" x2="${width - PADDING.right}" y2="${y}" stroke="var(--g-color-line-generic)"/>` +
        `<text x="${PADDING.left - 9}" y="${y + 4}" fill="var(--g-color-text-hint)" font-size="11" text-anchor="end">${fmt(value, 0)}%</text>`;
    }
    for (let index = 0; index <= AXIS_LABELS; index += 1) {
      const pointIndex = Math.round(((points.length - 1) * index) / AXIS_LABELS);
      const anchor = index === 0 ? 'start' : index === AXIS_LABELS ? 'end' : 'middle';
      grid += `<text x="${toX(pointIndex)}" y="${height - 12}" fill="var(--g-color-text-hint)" font-size="11" text-anchor="${anchor}">${escapeHtml(
        points[pointIndex].axisLabel,
      )}</text>`;
    }

    svg.innerHTML = `
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--g-color-accent-brand)" stop-opacity=".30"/>
          <stop offset="1" stop-color="var(--g-color-accent-brand)" stop-opacity="0"/>
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      ${grid}
      <line x1="${PADDING.left}" y1="${toY(START_CAPITAL)}" x2="${width - PADDING.right}" y2="${toY(START_CAPITAL)}" stroke="var(--g-color-text-hint)" stroke-dasharray="4 5" opacity=".6"/>
      <path d="${area}" fill="url(#areaGrad)"/>
      <path d="${line}" fill="none" stroke="var(--g-color-accent-brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)"/>
      <g id="hoverLayer"></g>
      <rect id="capture" x="${PADDING.left}" y="${PADDING.top}" width="${plotWidth}" height="${plotHeight}" fill="transparent" style="cursor:crosshair"/>
    `;

    const capture = svg.querySelector<SVGRectElement>('#capture');
    const hover = svg.querySelector<SVGGElement>('#hoverLayer');
    if (!capture || !hover) return;

    const update = (clientX: number, clientY: number): void => {
      const svgRect = svg.getBoundingClientRect();
      const localX = ((clientX - svgRect.left) * width) / svgRect.width;
      const rawIndex = Math.round(((localX - PADDING.left) * (points.length - 1)) / plotWidth);
      const index = Math.min(points.length - 1, Math.max(0, rawIndex));
      const point = points[index];
      const x = toX(index);
      const y = toY(point.after);

      hover.innerHTML =
        `<line x1="${x}" y1="${PADDING.top}" x2="${x}" y2="${height - PADDING.bottom}" stroke="var(--g-color-text-secondary)" stroke-dasharray="3 4"/>` +
        `<circle cx="${x}" cy="${y}" r="5" fill="var(--g-color-base-generic)" stroke="var(--g-color-accent-brand)" stroke-width="3"/>`;

      tooltip.style.display = 'block';
      tooltip.innerHTML = point.tooltip;

      const wrapRect = wrap.getBoundingClientRect();
      tooltip.style.left = `${Math.min(clientX - wrapRect.left + 14, wrap.clientWidth - 220)}px`;
      tooltip.style.top = `${Math.max(8, clientY - wrapRect.top - 20)}px`;
    };

    const onMove = (event: MouseEvent) => update(event.clientX, event.clientY);
    const onLeave = () => {
      hover.innerHTML = '';
      hideTooltip();
    };
    const onTouch = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (touch) update(touch.clientX, touch.clientY);
    };

    capture.addEventListener('mousemove', onMove);
    capture.addEventListener('mouseleave', onLeave);
    capture.addEventListener('touchmove', onTouch, { passive: false });

    detachPointer = () => {
      capture.removeEventListener('mousemove', onMove);
      capture.removeEventListener('mouseleave', onLeave);
      capture.removeEventListener('touchmove', onTouch);
    };
  }

  let frame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  });
  observer.observe(wrap);

  return {
    setData(series) {
      points = series.length === 0 ? [] : [startPoint, ...series.map(toPoint)];
      draw();
    },
    redraw: draw,
    destroy() {
      observer.disconnect();
      detachPointer?.();
    },
  };
}
