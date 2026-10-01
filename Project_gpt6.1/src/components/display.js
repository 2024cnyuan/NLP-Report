export const DISPLAY_KEY = 'tensorscope-display-v1';
export const displayDefaults = Object.freeze({ pageFont: 100, inspectorFont: 100, inspectorWidth: 340, inspectorHeight: 620, sidebarFont: 100, sidebarWidth: 230 });
export const displayLimits = Object.freeze({ pageFont: [90, 150], inspectorFont: [90, 180], inspectorWidth: [280, 960], inspectorHeight: [240, 1200], sidebarFont: [90, 150], sidebarWidth: [200, 420] });

export function sidebarWidthForViewport(requested, viewport) {
  const width = Number.isFinite(viewport) ? Math.max(0, viewport) : 1440;
  const max = width <= 800 ? Math.max(0, width - 32) : Math.min(420, width - 600);
  return Math.round(Math.min(max, Math.max(Math.min(200, max), requested)));
}

export function normalizeDisplay(value) {
  return Object.fromEntries(Object.entries(displayDefaults).map(([key, fallback]) => {
    const n = value?.[key], [min, max] = displayLimits[key];
    const step = key.endsWith('Font') ? 5 : 1;
    return [key, typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.max(min, Math.min(max, n)) / step) * step : fallback];
  }));
}

let settings = { ...displayDefaults }, panel, trigger, returnFocus, sidebarHandle;
function fitSidebarTitle() {
  const sidebar = document.querySelector('.sidebar'), title = sidebar.querySelector('.brand strong');
  sidebar.style.setProperty('--brand-fit', '1');
  const available = title.clientWidth, needed = title.scrollWidth;
  if (available > 0 && needed > available) sidebar.style.setProperty('--brand-fit', String(Math.max(.4, (available - 1) / needed)));
}
function applySidebar() {
  const width = sidebarWidthForViewport(settings.sidebarWidth, innerWidth);
  document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
  document.querySelector('.sidebar').style.setProperty('--text-scale', settings.sidebarFont / 100);
  if (sidebarHandle) {
    sidebarHandle.setAttribute('aria-valuenow', String(width));
    sidebarHandle.setAttribute('aria-valuemin', String(Math.min(200, width)));
    sidebarHandle.setAttribute('aria-valuemax', String(sidebarWidthForViewport(420, innerWidth)));
    sidebarHandle.setAttribute('aria-valuetext', `${width} 像素；左右方向键调整，Shift加速，Home/End设最窄/最宽`);
  }
  fitSidebarTitle();
  if(panel){const output=panel.querySelector('[data-display-value="sidebarWidth"]');output.textContent=width===settings.sidebarWidth?`${width}px`:`${settings.sidebarWidth}px（当前${width}px）`;}
}
function apply() {
  document.documentElement.style.setProperty('--text-scale', settings.pageFont / 100);
  applySidebar();
  const inspector = document.getElementById('inspector');
  inspector.style.setProperty('--text-scale', settings.inspectorFont / 100);
  inspector.style.setProperty('--inspector-width', `${settings.inspectorWidth}px`);
  inspector.style.setProperty('--inspector-height', `${settings.inspectorHeight}px`);
  if (panel) for (const key of Object.keys(displayDefaults)) {
    panel.querySelector(`#display-${key}`).value = settings[key];
    if(key!=='sidebarWidth')panel.querySelector(`[data-display-value="${key}"]`).textContent = `${settings[key]}${key.endsWith('Font') ? '%' : 'px'}`;
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
  const labels = { pageFont: '页面字号', inspectorFont: '显微镜字号（独立）', inspectorWidth: '显微镜宽度', inspectorHeight: '显微镜高度', sidebarFont: '侧栏字号（独立）', sidebarWidth: '侧栏宽度' };
  panel.innerHTML = `<div class="display-heading"><h2>字号、侧栏与显微镜</h2><button type="button" id="display-close" class="icon-btn" aria-label="关闭显示设置">×</button></div>
    ${Object.entries(displayLimits).map(([key, [min, max]]) => `<label class="display-field" for="display-${key}"><span>${labels[key]} <output data-display-value="${key}" for="display-${key}"></output></span><input id="display-${key}" type="range" min="${min}" max="${max}" step="${key.endsWith('Font') ? 5 : 1}"></label>`).join('')}
    <p class="small">拖动滑块即生效。侧栏右边缘可拖动；聚焦边缘后用左右方向键，Shift加速，双击恢复默认宽度。侧栏字号独立，标题自动保持单行。显微镜可拖左上角调整大小。小屏自动限幅。</p>
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
  bindSidebarResize();
}

function bindSidebarResize() {
  sidebarHandle = document.getElementById('resize-sidebar');
  const sidebar=document.querySelector('.sidebar'),closeButton=document.createElement('button');
  closeButton.id='sidebar-close';closeButton.type='button';closeButton.className='sidebar-close icon-btn';
  closeButton.setAttribute('aria-label','关闭导航');closeButton.textContent='×';
  closeButton.onclick=()=>{sidebar.classList.remove('visible');document.getElementById('mobile-menu').focus();};
  sidebar.prepend(closeButton);
  let drag;
  sidebarHandle.onpointerdown = e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, width: document.querySelector('.sidebar').getBoundingClientRect().width };
    sidebarHandle.setPointerCapture(e.pointerId); document.body.classList.add('resizing-sidebar'); e.preventDefault();
  };
  sidebarHandle.onpointermove = e => {
    if (drag) update({ sidebarWidth: sidebarWidthForViewport(drag.width + e.clientX - drag.x, innerWidth) }, false);
  };
  const end = () => { if (drag) { drag = null; document.body.classList.remove('resizing-sidebar'); persist(); } };
  sidebarHandle.onpointerup = end; sidebarHandle.onpointercancel = end; sidebarHandle.onlostpointercapture = end;
  sidebarHandle.ondblclick = () => update({ sidebarWidth: displayDefaults.sidebarWidth });
  sidebarHandle.onkeydown = e => {
    const step = e.shiftKey ? 50 : 10, width = document.querySelector('.sidebar').getBoundingClientRect().width;
    const next = { ArrowLeft: width-step, ArrowRight: width+step, Home: 200, End: 420 }[e.key];
    if (next != null) { e.preventDefault(); update({ sidebarWidth: sidebarWidthForViewport(next, innerWidth) }); }
  };
  window.addEventListener('resize', applySidebar);
  document.fonts?.ready.then(fitSidebarTitle);
  applySidebar();
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
