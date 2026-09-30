import { scaleLinear, scaleSequential, scaleDiverging, interpolateRgbBasis, interpolateRdBu, line, extent, ticks, contours, rgb } from 'd3';
import { escapeHTML, fmt } from '../components/ui.js';

export const probabilityColor = scaleSequential(interpolateRgbBasis(['#f0f7f5', '#bbdcd5', '#5ba79f', '#136f72', '#12474f'])).domain([0, 1]);
export function matrixHTML(matrix, { rows = [], cols = [], id = 'matrix', probability = false, selected, mask = [], maxRows = 16, maxCols = 16, offsetRow = 0, offsetCol = 0, domain, clickable = true } = {}) {
  const max = domain ?? matrix.reduce((m, row) => row.reduce((m, v) => Number.isFinite(v) ? Math.max(m, Math.abs(v)) : m, m), 0.001);
  const color = probability ? probabilityColor : scaleDiverging(interpolateRdBu).domain([-max, 0, max]);
  const displayed = matrix.slice(offsetRow, offsetRow + maxRows);
  const width = matrix[0]?.length ?? 0;
  return `<div class="matrix-scroll"><table class="matrix" id="${id}"><thead><tr><th class="axis-label">${probability ? 'Q ↓ · K →' : '行 ↓ · 维 →'}</th>${Array.from({ length: Math.min(width - offsetCol, maxCols) }, (_, j) => `<th>${escapeHTML(cols[j + offsetCol] ?? `d${j + offsetCol + 1}`)}</th>`).join('')}</tr></thead><tbody>${displayed.map((row, ri) => {
    const i = ri + offsetRow;
    return `<tr><th>${escapeHTML(rows[i] ?? `${i + 1}`)}</th>${row.slice(offsetCol, offsetCol + maxCols).map((value, cj) => {
      const j = cj + offsetCol, blocked = mask[i]?.[j], bg = blocked ? '#f0f2f4' : color(value), c = rgb(bg);
      const light = [c.r,c.g,c.b].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0), dark = light < .179;
      return `<td><${clickable ? 'button' : 'span'} ${clickable ? 'type="button"' : ''} class="matrix-cell ${selected?.[0] === i && selected?.[1] === j ? 'selected' : ''} ${blocked ? 'masked' : ''}" style="background:${bg};color:${dark && !blocked ? '#fff' : '#000'}" data-row="${i}" data-col="${j}" aria-label="${escapeHTML(rows[i] ?? i)}，${escapeHTML(cols[j] ?? j)}：${fmt(value, 6)}${blocked ? ' 已屏蔽' : ''}">${blocked ? '×' : fmt(value, 3)}</${clickable ? 'button' : 'span'}></td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody></table></div>`;
}
export const legend = (probability = true) => `<div class="legend"><span>${probability ? '0 · 无贡献' : '负值'}</span><i style="background:${probability ? 'linear-gradient(90deg,#f0f7f5,#136f72)' : 'linear-gradient(90deg,#b2182b,#f7f7f7,#2166ac)'}"></i><span>${probability ? '1 · 全部权重' : '正值'}</span><span class="legend-hint">点击数值，追踪计算</span></div>`;
export function barsHTML(values, labels, { id = 'bars', max = 1, selected = -1 } = {}) {
  return `<div class="bars" id="${id}">${values.map((v, i) => `<button class="bar-row ${i === selected ? 'selected' : ''}" data-index="${i}" type="button"><span class="bar-label">${escapeHTML(labels[i] ?? i)}</span><span class="bar-track"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></i></span><span class="bar-value">${fmt(v, 4)}</span></button>`).join('')}</div>`;
}
export function curveSVG(series, { yLabel = '交叉熵 / natural log', xLabel = '实际更新步', id = 'curve', height = 260, log = false, sharedDomain } = {}) {
  const W = 800, H = height, margin = { left: 55, right: 24, top: 24, bottom: 42 };
  const all = series.flatMap(s => s.values), xDomain = extent(all, d => d.x), yDomain = sharedDomain ?? extent(all, d => d.y);
  const x = scaleLinear().domain([xDomain[0] ?? 0, xDomain[1] || 1]).range([margin.left, W - margin.right]);
  const positiveMin=all.reduce((m,d)=>d.y>0?Math.min(m,d.y):m,Infinity),floor=Number.isFinite(positiveMin)?Math.max(Number.MIN_VALUE,positiveMin*.1):1e-300;
  const ymin = log ? Math.log10(Math.max(yDomain[0], floor)) : Math.min(yDomain[0] ?? 0, 0), ymax = log ? Math.log10(Math.max(yDomain[1], floor)) : (yDomain[1] || 1);
  const y = scaleLinear().domain([ymin, ymax === ymin ? ymax + 1 : ymax]).nice().range([H - margin.bottom, margin.top]);
  const sy = v => y(log ? Math.log10(Math.max(v, floor)) : v);
  // Bucket extrema keep spikes visible; computation and exports retain every point.
  const decimate = values => {
    if (values.length <= 800) return values;
    const output = [values[0]], size = Math.ceil(values.length / 350);
    for (let i = 1; i < values.length - 1; i += size) {
      const bucket = values.slice(i, i + size), a = bucket.reduce((a, b) => a.y < b.y ? a : b), b = bucket.reduce((a, b) => a.y > b.y ? a : b);
      output.push(...[a, b].sort((a, b) => a.x - b.x));
    }
    output.push(values.at(-1)); return output;
  };
  const singlePoints=series.map((s,i)=>s.values.length===1?`<circle cx="${x(s.values[0].x)}" cy="${sy(s.values[0].y)}" r="4" fill="${s.color??['#087f8c','#ba7938','#6971a3'][i%3]}"><title>${escapeHTML(s.label)}: ${fmt(s.values[0].y,6)}</title></circle>`:'').join('');
  return `<svg class="curve" id="${id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHTML(yLabel)}曲线"><text x="${margin.left}" y="14" class="chart-label">${escapeHTML(yLabel)}${log ? ' · log₁₀ 轴' : ''}</text>${y.ticks(5).map(v => `<g><path d="M${margin.left},${y(v)}H${W - margin.right}" stroke="#e6eced"/><text x="${margin.left - 10}" y="${y(v) + 4}" text-anchor="end" class="chart-tick">${log ? `10^${v}` : fmt(v, 2)}</text></g>`).join('')}${x.ticks(6).map(v => `<text x="${x(v)}" y="${H - 22}" text-anchor="middle" class="chart-tick">${v}</text>`).join('')}<text x="${W - margin.right}" y="${H - 3}" text-anchor="end" class="chart-label">${escapeHTML(xLabel)}</text>${series.map((s, i) => `<path fill="none" stroke="${s.color ?? ['#087f8c', '#ba7938', '#6971a3'][i % 3]}" stroke-width="2.5" ${i ? 'stroke-dasharray="5 4"' : ''} d="${line().x(d => x(d.x)).y(d => sy(d.y))(decimate(s.values)) ?? ''}"/>`).join('')}${singlePoints}</svg><div class="chart-legend">${series.map((s, i) => `<span><i style="background:${s.color ?? ['#087f8c', '#ba7938', '#6971a3'][i % 3]}"></i>${escapeHTML(s.label)}</span>`).join('')}</div>`;
}
export function contourSVG(data, history, loss, id = 'contour') {
  const size = 55, range = [-3, 3], scale = scaleLinear().domain(range).range([0, 330]);
  const values = Array.from({ length: size * size }, (_, k) => loss([-3 + (k % size) * 6 / (size - 1), 3 - Math.floor(k / size) * 6 / (size - 1)], data).loss);
  const levels = ticks(Math.min(...values), Math.max(...values), 10);
  const shapes = contours().size([size, size]).thresholds(levels)(values);
  const color = scaleSequential(interpolateRgbBasis(['#edf5f1', '#b9d9ce', '#679f9a', '#285c68'])).domain(extent(values));
  const path = shapes.map(s => `<path d="${s.coordinates.map(poly => poly.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${p[0] * 6},${p[1] * 6}`).join('') + 'Z').join('')).join('')}" fill="${color(s.value)}" fill-rule="evenodd" stroke="#fff" stroke-opacity=".25"/>`).join('');
  const visible = history.filter(h => h.w.every(w => w >= -3 && w <= 3));
  return `<svg id="${id}" viewBox="-34 -24 392 390" role="img" aria-label="Logistic 模型两个自由参数的真实损失等高线"><defs><clipPath id="contour-clip"><rect width="330" height="330"/></clipPath></defs><g clip-path="url(#contour-clip)">${path}<path d="${line().defined(h=>h.w.every(w=>w>=-3&&w<=3)).x(h => scale(h.w[0])).y(h => 330 - scale(h.w[1]))(history) ?? ''}" fill="none" stroke="#a65530" stroke-width="2"/>${visible.filter((_, i) => i % Math.max(1, Math.floor(visible.length / 24)) === 0 || i === visible.length - 1).map(h => `<circle cx="${scale(h.w[0])}" cy="${330 - scale(h.w[1])}" r="3" fill="#a65530"/>`).join('')}</g><text x="165" y="359" text-anchor="middle" class="chart-label">w₁ · 文本特征系数 [−3, 3]</text><text transform="translate(-18,165) rotate(-90)" text-anchor="middle" class="chart-label">w₂ · 截距 [−3, 3]</text></svg>`;
}
