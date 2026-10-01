// Only entries visited by this app instance are eligible for in-app Back.
// Native hash history remains the source of truth; copied hash state is not a traversal.
export function createNavigationJournal(route, session = String(Date.now())) {
  let entries = [{ route, scroll: 0 }], index = 0;
  const marker = () => ({ session, index, route: entries[index].route });
  return {
    marker,
    saveScroll(value) { entries[index].scroll = Math.max(0, Number(value) || 0); },
    visit(next, state) {
      const traversal = state?.session === session && Number.isInteger(state.index)
        && entries[state.index]?.route === next && state.route === next;
      if (traversal) index = state.index;
      else if (next !== entries[index].route) {
        entries = entries.slice(0, index + 1);
        entries.push({ route: next, scroll: 0 }); index++;
      }
      return { traversal, scroll: entries[index].scroll, ...marker() };
    },
    get back() { return index > 0 ? entries[index - 1].route : null; },
    get forward() { return index + 1 < entries.length ? entries[index + 1].route : null; },
  };
}

export function initNavigation(label) {
  const route = () => location.hash.slice(1) || 'home';
  const journal = createNavigationJournal(route(), `${Date.now()}-${Math.random()}`);
  const back = document.getElementById('navigation-back'), forward = document.getElementById('navigation-forward');
  const message = document.getElementById('navigation-origin');
  let busy = false, firstVisit = true;
  const stamp = () => {
    try { history.replaceState({ ...history.state, tensorScopeNavigation: journal.marker() }, ''); } catch { /* private/file storage restrictions */ }
  };
  const render = () => {
    back.disabled = busy || !journal.back; forward.disabled = busy || !journal.forward;
    back.title = journal.back ? `返回：${label(journal.back)}` : '本次打开尚无可返回的页面';
    forward.title = journal.forward ? `前进：${label(journal.forward)}` : '尚无可前进的页面';
    message.textContent = journal.back ? `来路：${label(journal.back)}` : '本次打开的起点';
  };
  back.onclick = () => { if (!journal.back || busy) return; journal.saveScroll(window.scrollY); busy = true; render(); history.back(); };
  forward.onclick = () => { if (!journal.forward || busy) return; journal.saveScroll(window.scrollY); busy = true; render(); history.forward(); };
  window.addEventListener('scroll', () => {
    if (route() === journal.marker().route && !busy) journal.saveScroll(window.scrollY);
  }, { passive: true });
  stamp(); render();
  return {
    visit() { const view = journal.visit(route(), history.state?.tensorScopeNavigation); if(firstVisit){view.traversal=false;firstVisit=false;} busy = false; stamp(); render(); return view; },
    restore(view, stillCurrent) {
      // Help chapters manage their own anchor and keyboard focus.
      if (view.route === 'help' || view.route.startsWith('help/')) return;
      if (view.route === 'comparison/diagnosis' && !view.traversal) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (stillCurrent()) window.scrollTo(0, view.traversal ? view.scroll : 0);
      }));
    },
  };
}
