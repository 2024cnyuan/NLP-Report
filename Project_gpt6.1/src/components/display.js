export const DISPLAY_KEY = 'tensorscope-display-v1';
export const displayDefaults = Object.freeze({ pageFont: 100, inspectorFont: 100, inspectorWidth: 340, inspectorHeight: 620 });
export const displayLimits = Object.freeze({ pageFont: [90, 150], inspectorFont: [90, 180], inspectorWidth: [280, 960], inspectorHeight: [240, 1200] });

export function normalizeDisplay(value) {
  return Object.fromEntries(Object.entries(displayDefaults).map(([key, fallback]) => {
    const n = value?.[key], [min, max] = displayLimits[key];
    const step = key.endsWith('Font') ? 5 : 1;
    return [key, typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.max(min, Math.min(max, n)) / step) * step : fallback];
  }));
}

let settings = { ...displayDefaults }, panel, trigger, returnFocus;
function apply() {
  document.documentElement.style.setProperty('--text-scale', settings.pageFont / 100);
  const inspector = document.getElementById('inspector');
  inspector.style.setProperty('--text-scale', settings.inspectorFont / 100);
  inspector.style.setProperty('--inspector-width', `${settings.inspectorWidth}px`);
  inspector.style.setProperty('--inspector-height', `${settings.inspectorHeight}px`);
  if (panel) for (const key of Object.keys(displayDefaults)) {
    panel.querySelector(`#display-${key}`).value = settings[key];
    panel.querySelector(`[data-display-value="${key}"]`).textContent = `${settings[key]}${key.endsWith('Font') ? '%' : 'px'}`;
  }
}
function persist() {
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(settings)); }
  catch { panel.querySelector('#display-storage').textContent = '浏览器无法保存显示偏好；本次会话仍可调节，刷新后可能恢复默认。'; }
}
function update(values, save = true) {
  const previousFont = settings.pageFont;
  settings = normalizeDisplay({ ...settings, ...values }); apply();
  if (settings.pageFont !== previousFont) window.dispatchEvent(new Event('tensorscope-display-change'));
  if (save) persist();
}
function close() {
  if (panel.hidden) return;
  panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
  document.querySelector('#inspector-display')?.setAttribute('aria-expanded', 'false');
  (returnFocus?.isConnected ? returnFocus : trigger).focus();
}
export function openDisplay(from = trigger, inspector = false) {
  returnFocus = from; panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
  document.querySelector('#inspector-display')?.setAttribute('aria-expanded', 'true');
  panel.querySelector(inspector ? '#display-inspectorFont' : '#display-pageFont').focus();
}

export function initDisplay() {
  try { settings = normalizeDisplay(JSON.parse(localStorage.getItem(DISPLAY_KEY))); } catch { settings = { ...displayDefaults }; }
  trigger = document.getElementById('display-toggle');
  panel = document.createElement('section'); panel.id = 'display-panel'; panel.className = 'display-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '字号与显微镜设置');
  const labels = { pageFont: '页面字号', inspectorFont: '显微镜字号（独立）', inspectorWidth: '显微镜宽度', inspectorHeight: '显微镜高度' };
  panel.innerHTML = `<div class="display-heading"><h2>字号与显微镜</h2><button type="button" id="display-close" class="icon-btn" aria-label="关闭显示设置">×</button></div>
    ${Object.entries(displayLimits).map(([key, [min, max]]) => `<label class="display-field" for="display-${key}"><span>${labels[key]} <output data-display-value="${key}" for="display-${key}"></output></span><input id="display-${key}" type="range" min="${min}" max="${max}" step="${key.endsWith('Font') ? 5 : 1}"></label>`).join('')}
    <p class="small">拖动滑块即生效。显微镜也可拖动左上角调整大小；方向键调整宽高。小屏自动限幅，内容在框内滚动。</p>
    <p class="small" id="display-storage" role="status">仅保存本机显示偏好，不改变输入、权重或实验结果。</p>
    <button type="button" class="btn" id="display-reset">恢复默认显示</button>`;
  document.body.append(panel); apply();
  trigger.onclick = () => panel.hidden ? openDisplay(trigger) : close();
  panel.querySelector('#display-close').onclick = close;
  panel.querySelector('#display-reset').onclick = () => update(displayDefaults);
  for (const key of Object.keys(displayDefaults)) panel.querySelector(`#display-${key}`).oninput = e => update({ [key]: Number(e.target.value) });
  document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !panel.contains(e.target) && !e.target.closest('#display-toggle,#inspector-display')) {
      panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
      document.querySelector('#inspector-display')?.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); close(); } });
}

export function bindInspectorDisplay(root) {
  root.querySelector('#inspector-display').onclick = e => openDisplay(e.currentTarget, true);
  const handle = root.querySelector('#resize-inspector'); let drag;
  handle.onpointerdown = e => {
    if (e.button !== 0) return;
    const rect = root.getBoundingClientRect(); drag = { x: e.clientX, y: e.clientY, width: rect.width, height: rect.height };
    handle.setPointerCapture(e.pointerId); e.preventDefault();
  };
  handle.onpointermove = e => {
    if (!drag) return;
    update({ inspectorWidth: Math.min(innerWidth - 24, drag.width + drag.x - e.clientX), inspectorHeight: Math.min(innerHeight - 90, drag.height + drag.y - e.clientY) }, false);
  };
  const end = () => { if (drag) { drag = null; persist(); } };
  handle.onpointerup = end; handle.onpointercancel = end; handle.onlostpointercapture = end;
  handle.onkeydown = e => {
    const step = e.shiftKey ? 50 : 10;
    const changes = { ArrowLeft: { inspectorWidth: settings.inspectorWidth + step }, ArrowRight: { inspectorWidth: settings.inspectorWidth - step }, ArrowUp: { inspectorHeight: settings.inspectorHeight + step }, ArrowDown: { inspectorHeight: settings.inspectorHeight - step } };
    if (changes[e.key]) { e.preventDefault(); update(changes[e.key]); }
  };
}
