// BEGIN Antigravity Usage Ring
;(() => {
  if (window.top !== window) return;
  window.__agUsageRingCleanup?.();

  const settingsSelector = '[role="navigation"] [data-testid="settings-button"]';
  const googleWeekly = 'gemini-weekly';
  const refreshInterval = 5 * 60_000;
  const hoverRefreshInterval = 60_000;
  const retryInterval = 15_000;
  const themeCtx = typeof ctx === 'object' && ctx ? ctx : undefined;
  const chinese = Boolean(themeCtx?.modules?.i18n);
  const labels = chinese ? {
    title: 'Antigravity 用量', credits: 'AI 点数余额', manage: '管理用量',
    weekly: '每周剩余', fiveHour: '5 小时剩余', reset: '重置',
    signIn: '请先登录 Antigravity', stale: '刷新失败，显示上次读数',
    unavailable: '暂时无法读取模型配额', loading: '正在读取模型配额…',
    empty: '当前没有模型配额数据', geminiWeekly: value => `Gemini 每周剩余 ${value}`
  } : {
    title: 'Antigravity usage', credits: 'AI credits', manage: 'Manage usage',
    weekly: 'Weekly remaining', fiveHour: '5-hour remaining', reset: 'Resets',
    signIn: 'Sign in to Antigravity', stale: 'Refresh failed. Showing the previous reading.',
    unavailable: 'Model quotas are temporarily unavailable', loading: 'Loading model quotas…',
    empty: 'No model quota data', geminiWeekly: value => `Gemini weekly quota ${value} remaining`
  };
  const locale = chinese ? 'zh-CN' : 'en';
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const resetDate = new Intl.DateTimeFormat(locale, {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  });

  const styles = document.createElement('style');
  styles.id = 'ag-google-quota-style';
  styles.textContent = `
    [data-ag-google-quota-footer] { position: relative; }
    [data-ag-google-quota-anchor] {
      anchor-name: --ag-google-quota-anchor;
      width: calc(100% - 36px) !important;
    }
    #ag-google-quota-ring {
      position: absolute;
      position-anchor: --ag-google-quota-anchor;
      top: anchor(center);
      left: calc(anchor(right) + 4px);
      translate: 0 -50%;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--foreground);
      cursor: pointer;
      --quota-track: color-mix(in srgb, var(--foreground) 20%, transparent);
      --quota-arc: light-dark(#1967d2, #8ab4f8);
      --quota-glyph: #8f8f8f;
    }
    #ag-google-quota-ring[data-level="low"] { --quota-arc: light-dark(#a65d00, #f9ab00); }
    #ag-google-quota-ring[data-level="critical"] { --quota-arc: light-dark(#c5221f, #f28b82); }
    #ag-google-quota-ring[data-level="empty"] {
      --quota-track: color-mix(in srgb, light-dark(#c5221f, #f28b82) 45%, transparent);
      --quota-glyph: light-dark(#c5221f, #f28b82);
    }
    #ag-google-quota-ring:hover, #ag-google-quota-ring[aria-expanded="true"] {
      background: var(--sidebar-muted);
    }
    #ag-google-quota-ring:focus-visible, #ag-google-quota-panel button:focus-visible {
      outline: 2px solid light-dark(#1967d2, #8ab4f8);
      outline-offset: -2px;
    }
    #ag-google-quota-panel {
      position: fixed;
      inset: auto;
      margin: 0;
      box-sizing: border-box;
      width: min(300px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow: auto;
      padding: 13px 14px 9px;
      border: 1px solid color-mix(in srgb, var(--foreground) 13%, transparent);
      border-radius: 12px;
      color: var(--foreground);
      background: color-mix(in srgb, var(--background) 94%, var(--foreground));
      box-shadow: 0 8px 26px rgb(0 0 0 / .24);
      font: 13px/1.45 system-ui, sans-serif;
    }
    #ag-google-quota-panel header, #ag-google-quota-panel .ag-quota-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    #ag-google-quota-panel header { padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    #ag-google-quota-panel header strong { font-weight: 650; }
    #ag-google-quota-panel header span, #ag-google-quota-panel small { color: var(--muted-foreground); }
    #ag-google-quota-panel section { margin-top: 9px; }
    #ag-google-quota-panel h3 { margin: 0 0 4px; font: inherit; font-weight: 600; }
    #ag-google-quota-panel .ag-quota-row { padding: 3px 0; }
    #ag-google-quota-panel .ag-quota-row > :last-child { text-align: right; font-variant-numeric: tabular-nums; }
    #ag-google-quota-panel small { display: block; font-size: 11px; }
    #ag-google-quota-panel [data-quota-status]:not(:empty) { margin-top: 7px; }
    #ag-google-quota-panel footer { margin-top: 7px; padding-top: 5px; border-top: 1px solid var(--border); }
    #ag-google-quota-panel button {
      color: inherit;
      font: inherit;
      background: transparent;
      border: 0;
      border-radius: 6px;
      padding: 5px 7px;
      margin-left: -7px;
      cursor: pointer;
    }
    #ag-google-quota-panel button:hover { background: var(--muted); }
  `;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'ag-google-quota-ring';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'ag-google-quota-panel');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
    <circle cx="13" cy="13" r="10.5" fill="none" stroke="var(--quota-track)" stroke-width="1.8"/>
    <circle data-quota-arc cx="13" cy="13" r="10.5" fill="none" stroke="var(--quota-arc)" stroke-width="1.8"
      stroke-linecap="round" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 13 13)" visibility="hidden"/>
    <text x="13" y="13" dy=".34em" text-anchor="middle" font-family="system-ui, sans-serif"
      font-size="9" font-weight="600" fill="var(--quota-glyph)">G</text>
  </svg>`;
  const arc = trigger.querySelector('[data-quota-arc]');

  const panel = document.createElement('div');
  panel.id = 'ag-google-quota-panel';
  panel.popover = 'manual';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'ag-google-quota-title');
  panel.innerHTML = `<header><strong id="ag-google-quota-title">${labels.title}</strong><span data-quota-plan></span></header>
    <div data-quota-groups></div>
    <section class="ag-quota-row"><span>${labels.credits}</span><strong data-quota-credits></strong></section>
    <small data-quota-status></small>
    <footer><button type="button">${labels.manage}</button></footer>`;
  const plan = panel.querySelector('[data-quota-plan]');
  const groups = panel.querySelector('[data-quota-groups]');
  const credits = panel.querySelector('[data-quota-credits]');
  const status = panel.querySelector('[data-quota-status]');

  let anchor, store, service, router, unsubscribe;
  let account, planName, creditBalance, quotas;
  let request, loadFailed = false, lastAttempt = 0;
  let pinned = false, closeTimer, mountFrame = 0, cleanedUp = false;
  const listeners = new AbortController();
  const signal = listeners.signal;

  function getAppProviders(button) {
    const fiberKey = Object.keys(button).find(key => key.startsWith('__reactFiber$'));
    if (!fiberKey) return {};
    const app = {};
    for (let fiber = button[fiberKey]; fiber; fiber = fiber.return) {
      const props = fiber.memoizedProps;
      const context = props?.value;
      app.store ??= context?.store ?? props?.store;
      app.service ??= (context ?? props?.services)?.core?.cloudCodeService;
      if (typeof context?.navigate === 'function') app.router ??= context;
      if (app.store && app.service && app.router) break;
    }
    return app;
  }

  function readFraction(bucket) {
    if (bucket?.disabled || bucket?.remaining?.case !== 'remainingFraction') return undefined;
    const value = bucket.remaining.value;
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
  }

  function isPanelOpen() {
    return panel.isConnected && panel.matches(':popover-open');
  }

  function renderPanel() {
    plan.textContent = planName ?? '';
    credits.textContent = Number.isFinite(creditBalance) ? number.format(creditBalance) : '—';
    groups.replaceChildren();
    for (const group of quotas ?? []) {
      const section = document.createElement('section');
      const title = document.createElement('h3');
      title.textContent = group.displayName;
      section.append(title);
      for (const bucket of group.buckets ?? []) {
        if (bucket.disabled) continue;
        const row = document.createElement('div');
        row.className = 'ag-quota-row';
        const label = document.createElement('span');
        label.textContent = bucket.window === 'weekly' ? labels.weekly :
          bucket.window === '5h' ? labels.fiveHour : bucket.displayName;
        const details = document.createElement('span');
        const value = readFraction(bucket);
        details.textContent = value === undefined ? '—' : percent.format(value);
        const resetMs = Number(bucket.resetTime?.seconds) * 1000;
        if (resetMs > Date.now()) {
          const reset = document.createElement('small');
          reset.textContent = `${labels.reset} ${resetDate.format(resetMs)}`;
          details.append(reset);
        }
        row.append(label, details);
        section.append(row);
      }
      if (section.childElementCount > 1) groups.append(section);
    }
    status.textContent = !account ? labels.signIn :
      loadFailed ? (quotas?.length ? labels.stale : labels.unavailable) :
      request && !quotas ? labels.loading : !quotas?.length ? labels.empty : '';
  }

  function render() {
    const weekly = quotas?.flatMap(group => group.buckets ?? []).find(bucket => bucket.bucketId === googleWeekly);
    const value = readFraction(weekly);
    const hasValue = value !== undefined;
    arc.setAttribute('visibility', value > 0 ? 'visible' : 'hidden');
    arc.setAttribute('stroke-dasharray', `${(value ?? 0) * 100} 100`);
    trigger.dataset.level = !hasValue ? 'unknown' : value <= 0 ? 'empty' : value < .1 ? 'critical' : value < .25 ? 'low' : 'normal';
    trigger.setAttribute('aria-label', hasValue ? `${labels.title}, ${labels.geminiWeekly(percent.format(value))}` : labels.title);
    if (isPanelOpen()) {
      renderPanel();
      positionPanel();
    }
  }

  async function refresh(minAge = refreshInterval) {
    if (document.hidden || !account || request) return;
    const effectiveMinAge = loadFailed && !quotas ? Math.min(minAge, retryInterval) : minAge;
    if (Date.now() - lastAttempt < effectiveMinAge) return;
    if (typeof service?.retrieveUserQuotaSummary !== 'function' && anchor?.isConnected) {
      service = getAppProviders(anchor).service;
    }
    if (typeof service?.retrieveUserQuotaSummary !== 'function') {
      lastAttempt = Date.now();
      loadFailed = true;
      render();
      return;
    }
    lastAttempt = Date.now();
    const pending = {};
    request = pending;
    loadFailed = false;
    render();
    try {
      const { response } = await service.retrieveUserQuotaSummary(false);
      if (request !== pending) return;
      if (!Array.isArray(response?.groups)) throw new Error('Missing model quota groups');
      quotas = response.groups;
    } catch {
      if (request === pending) loadFailed = true;
    } finally {
      if (request === pending) {
        request = undefined;
        render();
      }
    }
  }

  function readAccount() {
    const state = store?.getState();
    const signedIn = state?.authState?.current?.state === 'signedIn';
    const user = signedIn ? state.userStatus : undefined;
    const nextAccount = user?.email;
    const nextPlan = user?.userTier?.description;
    const nextCredits = user ? state.credits?.availableCredits : undefined;
    const accountChanged = nextAccount !== account;
    if (!accountChanged && nextPlan === planName && nextCredits === creditBalance) return;
    if (accountChanged) {
      account = nextAccount;
      quotas = request = undefined;
      loadFailed = false;
      lastAttempt = 0;
    }
    planName = nextPlan;
    creditBalance = nextCredits;
    render();
    if (accountChanged) void refresh();
  }

  function positionPanel() {
    const source = trigger.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(source.right + 8, innerWidth - width - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(source.bottom - height, innerHeight - height - 8))}px`;
  }

  function closePanel() {
    clearTimeout(closeTimer);
    pinned = false;
    if (isPanelOpen()) panel.hidePopover();
  }

  function openPanel() {
    clearTimeout(closeTimer);
    if (!panel.isConnected) return;
    if (!isPanelOpen()) {
      renderPanel();
      panel.showPopover({ source: trigger });
      positionPanel();
    }
    void refresh(loadFailed ? retryInterval : hoverRefreshInterval);
  }

  function queueClose() {
    clearTimeout(closeTimer);
    if (!pinned) closeTimer = setTimeout(closePanel, 220);
  }

  trigger.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') openPanel();
  }, { signal });
  trigger.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'touch') queueClose();
  }, { signal });
  trigger.addEventListener('click', () => {
    if (pinned) {
      closePanel();
    } else {
      pinned = true;
      openPanel();
    }
  }, { signal });
  panel.addEventListener('pointerenter', () => clearTimeout(closeTimer), { signal });
  panel.addEventListener('pointerleave', queueClose, { signal });
  panel.addEventListener('toggle', () => {
    const isOpen = isPanelOpen();
    trigger.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) pinned = false;
  }, { signal });
  document.addEventListener('pointerdown', event => {
    if (!isPanelOpen()) return;
    const target = event.target;
    if (target instanceof Node && (trigger.contains(target) || panel.contains(target))) return;
    closePanel();
  }, { capture: true, signal });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !isPanelOpen()) return;
    const wasInside = panel.contains(document.activeElement);
    closePanel();
    if (wasInside) trigger.focus();
  }, { signal });
  panel.querySelector('footer button').addEventListener('click', () => {
    closePanel();
    void router?.navigate({
      search: current => ({
        ...current, settingsOpen: true, settingsScreen: 'Models',
        settingsProjectId: undefined, settingsSection: undefined
      }),
      unsafeRelative: 'path'
    });
  }, { signal });
  window.addEventListener('resize', () => {
    if (isPanelOpen()) positionPanel();
  }, { signal });
  document.addEventListener('visibilitychange', () => void refresh(), { signal });

  function detachAnchor() {
    if (anchor) {
      anchor.parentElement?.removeAttribute('data-ag-google-quota-footer');
      anchor.removeAttribute('data-ag-google-quota-anchor');
      anchor = undefined;
    }
    if (trigger.isConnected) trigger.remove();
    closePanel();
  }

  function mount() {
    if (cleanedUp || (anchor?.isConnected && trigger.isConnected)) return;
    if (anchor || trigger.isConnected || isPanelOpen()) detachAnchor();
    const nextAnchor = document.querySelector(settingsSelector);
    if (!nextAnchor || !nextAnchor.parentElement) return;
    const app = getAppProviders(nextAnchor);
    if (!app.store || !app.router) return;
    anchor = nextAnchor;
    router = app.router;
    service = app.service;
    if (app.store !== store) {
      unsubscribe?.();
      store = app.store;
      unsubscribe = store.subscribe(readAccount);
    }
    anchor.parentElement.setAttribute('data-ag-google-quota-footer', '');
    anchor.setAttribute('data-ag-google-quota-anchor', '');
    anchor.after(trigger);
    readAccount();
    render();
  }

  function scheduleMount() {
    if (anchor?.isConnected && trigger.isConnected) return;
    if (mountFrame) return;
    mountFrame = requestAnimationFrame(() => {
      mountFrame = 0;
      mount();
    });
  }

  for (const id of ['ag-google-quota-style', 'ag-google-quota-panel', 'ag-google-quota-ring']) {
    document.getElementById(id)?.remove();
  }
  document.head.append(styles);
  document.body.append(panel);
  const observer = new MutationObserver(scheduleMount);
  observer.observe(document.body, { childList: true, subtree: true });
  const refreshTimer = setInterval(() => void refresh(), refreshInterval);

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    if (window.__agUsageRingCleanup === cleanup) delete window.__agUsageRingCleanup;
    observer.disconnect();
    listeners.abort();
    unsubscribe?.();
    unsubscribe = undefined;
    cancelAnimationFrame(mountFrame);
    mountFrame = 0;
    clearTimeout(closeTimer);
    clearInterval(refreshTimer);
    request = undefined;
    detachAnchor();
    panel.remove();
    styles.remove();
  }

  window.__agUsageRingCleanup = cleanup;
  themeCtx?.onCleanup?.(cleanup);
  mount();
})();
// END Antigravity Usage Ring
