export const escapeHTML = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (v, d = 4) => Number.isFinite(v) ? Number(v).toFixed(d) : (v === -Infinity ? '−∞' : '—');
export const pct = v => `${(v * 100).toFixed(1)}%`;
export const icon = (name, size = 20) => {
  const paths = {
    scope: '<path d="M4 6h16M12 6v14M7 11h10"/><circle cx="12" cy="18" r="2"/>',
    home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
    embeddings: '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="16" cy="18" r="2"/><circle cx="5" cy="19" r="2"/><path d="m8 7 8-2M7 9l8 7M7 18l7 0"/>',
    sequence: '<rect x="2" y="8" width="5" height="8" rx="1"/><rect x="10" y="8" width="5" height="8" rx="1"/><rect x="18" y="8" width="4" height="8" rx="1"/><path d="M7 12h3m5 0h3M12 8V4h8v4"/>',
    cnn: '<path d="M3 4h10v14H3zM7 4v14M3 9h10m-10 5h10M17 7h4v4h-4zM17 15h4v4h-4zM13 9h4m-4 7h4"/>',
    attention: '<path d="M4 3v18m5-18v18m5-18v18m5-18v18M3 5h18M3 10h18M3 15h18M3 20h18"/>',
    comparison: '<path d="M4 20V9h4v11M10 20V4h4v16M16 20V12h4v8M2 20h20"/>',
    optimization: '<path d="M3 3v18h18M5 7l4 5 4-2 4 7 4-1"/>',
    data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    notebook: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 7h7M9 11h7M9 15h4M2 7h5m-5 5h5m-5 5h5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3l-1 1M12 17h.01"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    play: '<path d="m8 4 12 8-12 8z"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    reset: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    compare: '<path d="M4 5h7v14H4zM14 5h7v14h-7zM9 2l3 3-3 3M16 22l-3-3 3-3"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m5 5 14 14M5 19 19 5"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.scope}</svg>`;
};
export const button = (label, id, kind = '', i = '') => `<button type="button" id="${id}" class="btn ${kind}">${i ? icon(i, 17) : ''}<span>${label}</span></button>`;
export const field = (label, control, help = '') => `<label class="field"><span class="field-label">${label}</span>${control}${help ? `<small>${help}</small>` : ''}</label>`;
export const select = (id, options, value) => `<select id="${id}">${options.map(([v, label]) => `<option value="${escapeHTML(v)}" ${v === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}</select>`;
export const number = (id, value, min, max, step = 1) => `<input id="${id}" type="number" min="${min}" max="${max}" step="${step === 1 ? 1 : 'any'}" value="${value}" required>`;
export const panel = (title, sub, body, tools = '', cls = '') => `<section class="panel ${cls}"><div class="panel-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${tools}</div>${body}</section>`;
export const note = s => `<div class="note">${icon('help', 17)}<span>${s}</span></div>`;
export function notify(message, error = false) {
  const root = document.querySelector('#toast'); root.textContent = message; root.className = `toast visible ${error ? 'error' : ''}`;
  clearTimeout(notify.timer); notify.timer = setTimeout(() => { root.className = 'toast'; }, 4500);
}
export function getNumber(id) { const el = document.getElementById(id); if (!el.checkValidity()) throw new Error(`${el.closest('label')?.querySelector('span')?.textContent ?? id} 超出有效范围`); return Number(el.value); }
export const download = (name, data, mime = 'application/json') => {
  const url = URL.createObjectURL(new Blob([data], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function inspect({ title, value, formula, inputs, shape, source, detail }) {
  const root = document.getElementById('inspector');
  if (root.dataset.locked === 'true') { notify('检查器已锁定，请先解除锁定'); return; }
  root.classList.add('open');
  root.innerHTML = `<div class="inspector-title"><span>${icon('search', 17)} 计算显微镜</span><button class="icon-btn" id="close-inspector" aria-label="关闭检查器">${icon('close', 18)}</button></div><div class="inspect-content"><span class="eyebrow">${escapeHTML(shape ?? 'TRACE / 真实计算')}</span><h3>${escapeHTML(title)}</h3><div class="inspect-value">${typeof value === 'number' ? fmt(value, 6) : escapeHTML(value)}</div><div class="formula">${escapeHTML(formula)}</div><h4>输入数值</h4><pre>${escapeHTML(typeof inputs === 'string' ? inputs : JSON.stringify(inputs, null, 2))}</pre>${detail ? `<p>${escapeHTML(detail)}</p>` : ''}<h4>上游来源</h4><p>${escapeHTML(source)}</p><button class="btn" id="lock-inspector">${icon('lock', 16)} 锁定此计算</button></div>`;
  root.querySelector('#close-inspector').onclick = () => { root.classList.remove('open'); root.dataset.locked = 'false'; };
  root.querySelector('#lock-inspector').onclick = e => { root.dataset.locked = root.dataset.locked === 'true' ? 'false' : 'true'; e.currentTarget.innerHTML = `${icon('lock', 16)} ${root.dataset.locked === 'true' ? '解除锁定' : '锁定此计算'}`; };
}
export function safe(handler) { return async (...args) => { try { await handler(...args); } catch (e) { notify(e.message, true); } }; }
