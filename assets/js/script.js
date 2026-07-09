const subscribeForm = document.querySelector('[data-subscribe-inline]');
const subscribeStatus = document.querySelector('.subscribe-inline-status');
// Cloudflare Worker that proxies Brevo (keeps the API key server-side).
// After deploying subscribe-worker.js, set this to the worker URL, e.g.
// 'https://cidirilk-subscribe.<you>.workers.dev/'.
const SUBSCRIBE_ENDPOINT = 'https://cidirilk-subscribe.cidirilk.workers.dev/';
const LOCAL_SUBSCRIBE_ENDPOINT = 'http://127.0.0.1:8787/';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
const SUBSCRIBE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tabButtons = document.querySelectorAll('[data-tab]');
const tabPanels = document.querySelectorAll('[data-panel]');
const TAB_COOKIE = 'cidirilkActiveTab';
const root = document.documentElement;
const header = document.getElementById('siteHeader');
const themeToggle = document.querySelector('.theme-toggle');
const yearEl = document.getElementById('year');
const LIVESETS_STATUS_ENDPOINT = 'https://livesets.com/app/polling/live/42069';
const LIVESETS_POLL_INTERVAL = 15000;
// Preferred proxy: your own Cloudflare Worker (see livesets-proxy-worker.js).
// Once deployed, set this to the worker URL, e.g. 'https://livesets-proxy.<you>.workers.dev/'.
// The worker is the durable long-term path; public proxies below are only fallbacks.
const LIVESETS_PROXY_WORKER = 'https://livesets-proxy.cidirilk.workers.dev/';
const chatToggles = document.querySelectorAll('[data-chat-toggle]');
const chatPanel = document.querySelector('[data-chat-panel]');
const chatClose = document.querySelector('[data-chat-close]');
const mobileRadioToggle = document.querySelector('[data-mobile-radio-toggle]');
const mobileRadioPopover = document.querySelector('[data-mobile-radio-popover]');
const desktopRadioPopup = document.querySelector('[data-desktop-radio-popup]');
const desktopRadioToggle = document.querySelector('[data-desktop-radio-toggle]');
const desktopRadioClose = document.querySelector('[data-desktop-radio-close]');
const RADIO_POPOVER_TRANSITION_MS = 240;
const DESKTOP_RADIO_COLLAPSE_MS = 260;
const RADIO_PRESS_FEEDBACK_MS = 170;
const pageLoader = document.querySelector('[data-page-loader]');
const loaderEnter = document.querySelector('[data-loader-enter]');
const loaderMessage = document.querySelector('[data-loader-message]');
const loaderMessages = [
  'Click anywhere to enter',
  'Scanning rave memory...',
  'Calibrating rhythm engines...',
  'Warning dark matter...',
  "Rendering cosmos..."
];
let loaderMessageTimer = null;
let ticking = false;
let mobileRadioCloseTimer = null;
let desktopRadioCollapseTimer = null;
const radioPressTimers = new WeakMap();

// Prevent scroll restoration on Android
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Ensure starting at top
window.scrollTo(0, 0);

const markBodyLoaded = () => document.body?.classList.add('is-loaded');

const rememberLoaderSeen = () => {
  try {
    localStorage.setItem('loaderSeen', '1');
  } catch (e) {}
};

const completeLoader = () => {
  if (document.body?.classList.contains('loader-complete')) return;
  rememberLoaderSeen();
  markBodyLoaded();
  document.body?.classList.add('loader-complete');
  pageLoader?.setAttribute('aria-hidden', 'true');
  if (loaderMessageTimer) {
    clearInterval(loaderMessageTimer);
    loaderMessageTimer = null;
  }
  
  // Ensure page starts at top (fixes Android scroll issue)
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  }, 50);
};

const handleLoaderEnter = () => {
  if (document.body?.classList.contains('loader-complete')) return;
  completeLoader();
  loaderEnter?.removeEventListener('click', handleLoaderEnter);
  pageLoader?.removeEventListener('click', handleLoaderOverlayClick);
};

const handleLoaderOverlayClick = (event) => {
  if (event.target.closest('[data-loader-enter]')) return;
  handleLoaderEnter();
};

const loaderAlreadySeen = (() => {
  try {
    return localStorage.getItem('loaderSeen') === '1';
  } catch (e) {
    return false;
  }
})();

const startLoaderMessages = () => {
  if (!loaderMessage || loaderMessages.length <= 1) return;
  let index = 0;
  loaderMessage.textContent = loaderMessages[index];
  loaderMessageTimer = setInterval(() => {
    index = (index + 1) % loaderMessages.length;
    loaderMessage.textContent = loaderMessages[index];
  }, 2600);
};

if (loaderAlreadySeen) {
  // Returning visitor: skip the intro gate entirely.
  completeLoader();
} else {
  loaderEnter?.addEventListener('click', handleLoaderEnter);
  pageLoader?.addEventListener('click', handleLoaderOverlayClick);
  startLoaderMessages();
}

const setCookie = (name, value, days = 60) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
};

const getCookie = (name) =>
  document.cookie
    .split('; ')
    .map((row) => row.split('='))
    .reduce((acc, [key, val]) => (key === name ? decodeURIComponent(val) : acc), null);

const tabPanelsWrap = tabPanels[0]?.closest('.tab-panels') || null;
const tabReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tabMobileQuery = window.matchMedia('(max-width: 640px)');
let tabHeightTimer = null;
let fitTurnstile = () => {};

// Smoothly morph the panel container between the old and new panel heights so
// switching tabs never jumps abruptly or flashes the column scrollbar.
const animatePanelHeight = (fromHeight) => {
  if (!tabPanelsWrap || tabReducedMotion || fromHeight == null) return;
  const toHeight = tabPanelsWrap.offsetHeight;
  if (Math.round(fromHeight) === Math.round(toHeight)) return;

  if (tabHeightTimer) {
    clearTimeout(tabHeightTimer);
    tabHeightTimer = null;
  }

  const cleanup = () => {
    tabPanelsWrap.style.transition = '';
    tabPanelsWrap.style.height = '';
    tabPanelsWrap.style.overflow = '';
    tabPanelsWrap.removeEventListener('transitionend', onEnd);
  };
  const onEnd = (event) => {
    if (event.propertyName === 'height') cleanup();
  };

  tabPanelsWrap.style.overflow = 'hidden';
  tabPanelsWrap.style.height = `${fromHeight}px`;
  // Force reflow so the starting height is committed before transitioning.
  void tabPanelsWrap.offsetHeight;
  tabPanelsWrap.style.transition = 'height 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)';
  tabPanelsWrap.style.height = `${toHeight}px`;
  tabPanelsWrap.addEventListener('transitionend', onEnd);
  tabHeightTimer = setTimeout(cleanup, 700);
};

const scrollTabPanelIntoView = () => {
  if (!tabPanelsWrap || tabMobileQuery.matches) return;

  requestAnimationFrame(() => {
    tabPanelsWrap.scrollIntoView({
      behavior: tabReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  });
};

const syncSubscribePanelAfterActivation = (target) => {
  if (target !== 'subscribe') return;

  requestAnimationFrame(() => {
    fitTurnstile();
    setTimeout(fitTurnstile, 300);
  });
};

const setActiveTab = (target, persist = true, animate = false) => {
  if (tabMobileQuery.matches) return;

  const shouldAnimateHeight =
    animate && tabPanelsWrap && !tabReducedMotion;
  const fromHeight =
    shouldAnimateHeight ? tabPanelsWrap.offsetHeight : null;

  tabButtons.forEach((btn) => {
    const match = btn.getAttribute('data-tab') === target;
    btn.classList.toggle('active', match);
    btn.setAttribute('aria-selected', String(match));
  });
  tabPanels.forEach((panel) => {
    const match = panel.getAttribute('data-panel') === target;
    panel.toggleAttribute('hidden', !match);
    panel.classList.toggle('active', match);
  });
  if (persist) {
    setCookie(TAB_COOKIE, target);
  }

  animatePanelHeight(fromHeight);
  syncSubscribePanelAfterActivation(target);
  if (animate) {
    scrollTabPanelIntoView();
  }
};

const showMobileTabSections = () => {
  tabButtons.forEach((btn) => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  tabPanels.forEach((panel) => {
    panel.removeAttribute('hidden');
    panel.classList.add('active');
  });
  if (tabPanelsWrap) {
    tabPanelsWrap.style.transition = '';
    tabPanelsWrap.style.height = '';
    tabPanelsWrap.style.overflow = '';
  }
};

const syncTabLayoutForViewport = () => {
  if (!tabButtons.length || !tabPanels.length) return;

  if (tabMobileQuery.matches) {
    showMobileTabSections();
    return;
  }

  const current =
    [...tabButtons].find((button) => button.classList.contains('active'))?.getAttribute('data-tab') ||
    getCookie(TAB_COOKIE) ||
    'social';
  const hasPanel = [...tabPanels].some((panel) => panel.getAttribute('data-panel') === current);
  setActiveTab(hasPanel ? current : 'social', false);
};

if (tabButtons.length && tabPanels.length) {
  const saved = getCookie(TAB_COOKIE);
  const defaultTab = saved && [...tabPanels].some((panel) => panel.getAttribute('data-panel') === saved) ? saved : 'social';
  if (tabMobileQuery.matches) {
    showMobileTabSections();
  } else {
    setActiveTab(defaultTab, false);
  }
  
  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-tab');
      setActiveTab(target, true, true);
    });
    
    // Add keyboard navigation for tabs
    button.addEventListener('keydown', (e) => {
      let newIndex = index;
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = (index + 1) % tabButtons.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        newIndex = tabButtons.length - 1;
      } else {
        return;
      }
      
      tabButtons[newIndex].focus();
      const target = tabButtons[newIndex].getAttribute('data-tab');
      setActiveTab(target, true, true);
    });
  });

  if (typeof tabMobileQuery.addEventListener === 'function') {
    tabMobileQuery.addEventListener('change', syncTabLayoutForViewport);
  } else {
    tabMobileQuery.addListener(syncTabLayoutForViewport);
  }
}

const subscribeSubmit = subscribeForm?.querySelector('[data-subscribe-submit]');
const subscribeLabel = subscribeForm?.querySelector('[data-subscribe-label]');
let subscribeBusy = false;

const setSubscribeStatus = (msg, type) => {
  if (!subscribeStatus) return;
  subscribeStatus.textContent = msg;
  subscribeStatus.classList.toggle('is-error', type === 'error');
  subscribeStatus.classList.toggle('is-success', type === 'success');
};

const getSubscribeEndpoint = () =>
  LOCAL_HOSTS.has(window.location.hostname)
    ? LOCAL_SUBSCRIBE_ENDPOINT
    : SUBSCRIBE_ENDPOINT;

// Safe no-op unless GA/GTM is added later.
const trackSubscribe = (action) => {
  try {
    if (typeof window.gtag === 'function') window.gtag('event', 'subscribe_' + action);
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'subscribe_' + action });
  } catch (e) {}
};

subscribeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (subscribeBusy) return; // duplicate-request protection

  const formData = new FormData(subscribeForm);
  const email = String(formData.get('subEmail') || '').trim();
  const honeypot = String(formData.get('company') || '').trim();
  const turnstileToken = String(formData.get('cf-turnstile-response') || '');

  // Bot filled the hidden field: pretend success, do nothing.
  if (honeypot) {
    setSubscribeStatus('Thanks!', 'success');
    subscribeForm.reset();
    return;
  }
  if (!email) {
    setSubscribeStatus('Please enter your email address.', 'error');
    return;
  }
  if (email.length > 254 || !SUBSCRIBE_EMAIL_RE.test(email)) {
    setSubscribeStatus('That email does not look right. Please check it.', 'error');
    return;
  }
  if (!turnstileToken) {
    setSubscribeStatus('Please complete the verification challenge.', 'error');
    return;
  }

  subscribeBusy = true;
  if (subscribeSubmit) {
    subscribeSubmit.disabled = true;
    subscribeSubmit.setAttribute('aria-busy', 'true');
  }
  if (subscribeLabel) subscribeLabel.textContent = 'Joining...';
  setSubscribeStatus('Sending...', null);
  trackSubscribe('submit');

  try {
    const resp = await fetch(getSubscribeEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, company: honeypot, token: turnstileToken }),
    });
    const result = await resp.json().catch(() => ({}));

    if (resp.ok && result.ok) {
      setSubscribeStatus('Almost there - check your inbox to confirm.', 'success');
      subscribeForm.reset();
      trackSubscribe('success');
    } else if (resp.status === 429) {
      setSubscribeStatus('Too many attempts. Please try again in a minute.', 'error');
    } else if (result.error === 'failed_captcha') {
      setSubscribeStatus('Verification failed. Please try the challenge again.', 'error');
    } else if (result.error === 'invalid_email') {
      setSubscribeStatus('That email does not look right. Please check it.', 'error');
    } else {
      setSubscribeStatus('Something went wrong. Please try again later.', 'error');
      trackSubscribe('error');
    }
  } catch (err) {
    setSubscribeStatus('Network error. Please try again.', 'error');
    trackSubscribe('error');
  } finally {
    subscribeBusy = false;
    if (subscribeSubmit) {
      subscribeSubmit.disabled = false;
      subscribeSubmit.removeAttribute('aria-busy');
    }
    if (subscribeLabel) subscribeLabel.textContent = 'Join the log';
    // Turnstile tokens are single-use; reset so the next attempt gets a fresh one.
    if (window.turnstile && turnstileWidgetId !== null) {
      try {
        window.turnstile.reset(turnstileWidgetId);
      } catch (e) {}
    }
  }
});

// Turnstile: render explicitly so the widget theme follows the site's dark/light
// toggle instead of the visitor's OS preference.
let turnstileWidgetId = null;
const TURNSTILE_TEST_SITEKEY = '1x00000000000000000000AA';
const TURNSTILE_MIN_WIDTH = 300; // "flexible" widget can't render narrower than this.
const TURNSTILE_SIDE_INSET = 6; // px narrower than the input/button on each side.

const getTurnstileSitekey = (el) =>
  LOCAL_HOSTS.has(window.location.hostname)
    ? TURNSTILE_TEST_SITEKEY
    : el.dataset.sitekey;

// Match the input/button width but pull in a few px on each side, centered.
// When the card is too narrow for the 300px minimum, scale the widget to fit.
fitTurnstile = () => {
  const wrap = document.querySelector('.subscribe-turnstile');
  const inner = document.getElementById('subscribeTurnstile');
  if (!wrap || !inner) return;
  inner.style.transform = '';
  inner.style.width = '100%';
  inner.style.margin = '';
  wrap.style.height = '';
  const avail = wrap.clientWidth;
  if (avail <= 0) return;
  const target = Math.max(0, avail - TURNSTILE_SIDE_INSET * 2);
  if (target >= TURNSTILE_MIN_WIDTH) {
    inner.style.width = target + 'px';
    inner.style.margin = '0 auto';
  } else {
    const scale = target / TURNSTILE_MIN_WIDTH;
    inner.style.width = TURNSTILE_MIN_WIDTH + 'px';
    inner.style.transformOrigin = 'top left';
    inner.style.transform = 'scale(' + scale + ')';
    inner.style.marginLeft = (avail - target) / 2 + 'px';
    wrap.style.height = inner.offsetHeight * scale + 'px';
  }
};

const renderTurnstile = () => {
  const el = document.getElementById('subscribeTurnstile');
  if (!el || !window.turnstile) return;
  if (turnstileWidgetId !== null) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch (e) {}
    turnstileWidgetId = null;
  }
  turnstileWidgetId = window.turnstile.render(el, {
    sitekey: getTurnstileSitekey(el),
    action: el.dataset.action,
    theme: root.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    size: 'flexible',
  });
  fitTurnstile();
  // The widget iframe sizes itself shortly after render; refit once it's ready.
  setTimeout(fitTurnstile, 300);
};

// Cloudflare's api.js invokes this once it has finished loading.
window.onloadTurnstile = renderTurnstile;
renderTurnstile();

const syncThemeIcon = () => {
  const themeIcon = document.querySelector('.theme-icon');
  if (!themeIcon) return;
  const theme = root.getAttribute('data-theme') || 'dark';
  themeIcon.className = theme === 'light' ? 'theme-icon fa-solid fa-moon' : 'theme-icon fa-solid fa-sun';
};

const setTheme = (mode) => {
  root.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  syncThemeIcon();
  // Turnstile can't restyle live, so re-render it to match the new theme.
  renderTurnstile();
  
  // Force repaint on mobile
  document.body.style.display = 'none';
  document.body.offsetHeight; // Trigger reflow
  document.body.style.display = '';
};

const initTheme = () => {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  
  if (stored) {
    root.setAttribute('data-theme', stored);
  } else if (prefersLight) {
    // Only use light if user explicitly prefers it
    root.setAttribute('data-theme', 'light');
  } else {
    // Default to dark for everyone else
    root.setAttribute('data-theme', 'dark');
  }
  syncThemeIcon();
};

const toggleTheme = () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  setTheme(next);
};

const handleScroll = () => {
  if (!header || ticking) return;
  
  ticking = true;
  requestAnimationFrame(() => {
    header.classList.toggle('scrolled', window.scrollY > 30);
    ticking = false;
  });
};

const openChat = () => chatPanel?.classList.add('is-open');
const closeChat = () => chatPanel?.classList.remove('is-open');

// Custom nickname prompt
const nicknameOverlay = document.querySelector('[data-nickname-overlay]');
const nicknameForm = document.querySelector('[data-nickname-form]');
const nicknameCancel = document.querySelector('[data-nickname-cancel]');
const NICKNAME_COOKIE = 'cidirilkChatNickname';
let chatLoaded = false;

const getSavedNickname = () => getCookie(NICKNAME_COOKIE);

const saveNickname = (nickname) => {
  setCookie(NICKNAME_COOKIE, nickname, 365); // Save for 1 year
};

const showNicknamePrompt = () => {
  nicknameOverlay?.removeAttribute('hidden');
  // Pre-fill with saved nickname if exists
  const savedNick = getSavedNickname();
  const input = document.querySelector('#chatNickname');
  if (input && savedNick) {
    input.value = savedNick;
  }
  setTimeout(() => {
    input?.focus();
    input?.select();
  }, 100);
};

const hideNicknamePrompt = () => {
  nicknameOverlay?.setAttribute('hidden', '');
};

const loadChatWithNickname = (nickname) => {
  if (!chatPanel || !nickname) return;
  
  chatLoaded = true;
  saveNickname(nickname); // Save to cookie
  
  // Update chat panel with iframe including nickname
  chatPanel.innerHTML = `
    <header class="chat-header">
      <div>
        <p class="label">Free chat</p>
        <h3>hack.chat / cidirilk</h3>
      </div>
      <button class="icon-button chat-close" type="button" aria-label="Close chat" data-chat-close>
        <i class="fa-solid fa-xmark"></i>
      </button>
    </header>
    <iframe
      title="hack.chat cidirilk room"
      src="https://hack.chat/?cidirilk#${encodeURIComponent(nickname)}"
      loading="lazy"
      referrerpolicy="no-referrer"
    ></iframe>
    <p class="chat-helper">Hosted on hack.chat — no login required. If the embed fails, open the room directly.</p>
    <a class="btn ghost compact" href="https://hack.chat/?cidirilk" target="_blank" rel="noopener">Open hack.chat</a>
  `;
  
  // Re-attach close button listener
  const newCloseBtn = chatPanel.querySelector('[data-chat-close]');
  newCloseBtn?.addEventListener('click', closeChat);
  
  openChat();
  hideNicknamePrompt();
};

nicknameForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const nickname = e.target.nickname.value.trim();
  if (nickname) {
    loadChatWithNickname(nickname);
  }
});

nicknameCancel?.addEventListener('click', hideNicknamePrompt);

// Close nickname prompt on overlay click
nicknameOverlay?.addEventListener('click', (e) => {
  if (e.target === nicknameOverlay) {
    hideNicknamePrompt();
  }
});

chatToggles.forEach((toggle) =>
  toggle.addEventListener('click', () => {
    if (chatPanel?.classList.contains('is-open')) {
      closeChat();
    } else {
      // Check if we have a saved nickname and haven't loaded chat yet
      const savedNick = getSavedNickname();
      if (!chatLoaded && savedNick) {
        loadChatWithNickname(savedNick);
      } else if (!chatLoaded) {
        showNicknamePrompt();
      } else {
        openChat();
      }
    }
  })
);

themeToggle?.addEventListener('click', toggleTheme);
window.addEventListener('scroll', handleScroll, { passive: true });

// Debounced resize handler
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    handleScroll();
    // Keep the widget scaled to the current card width.
    if (turnstileWidgetId !== null) fitTurnstile();
  }, 150);
}, { passive: true });

const setMobileRadioToggleLabel = () => {
  if (!mobileRadioToggle) return;
  const expanded = mobileRadioToggle.getAttribute('aria-expanded') === 'true';
  const isLive = mobileRadioToggle.classList.contains('is-live');
  const stateText = isLive ? 'LiveSets radio is live' : 'LiveSets radio is offline';
  mobileRadioToggle.setAttribute('aria-label', `${expanded ? 'Close' : 'Open'} radio popup. ${stateText}.`);
};

const setDesktopRadioToggleLabel = () => {
  if (!desktopRadioToggle || !desktopRadioPopup) return;
  const expanded = desktopRadioToggle.getAttribute('aria-expanded') === 'true';
  const isLive = desktopRadioPopup.classList.contains('is-live');
  const stateText = isLive ? 'LiveSets radio is live' : 'LiveSets radio is offline';
  desktopRadioToggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} radio popup. ${stateText}.`);
};

const expandDesktopRadioPopup = () => {
  if (!desktopRadioPopup || !desktopRadioToggle) return;
  if (desktopRadioCollapseTimer) {
    clearTimeout(desktopRadioCollapseTimer);
    desktopRadioCollapseTimer = null;
  }
  desktopRadioPopup.classList.remove('is-collapsing');
  desktopRadioPopup.classList.remove('is-collapsed');
  desktopRadioToggle.setAttribute('aria-expanded', 'true');
  setDesktopRadioToggleLabel();
};

const collapseDesktopRadioPopup = () => {
  if (!desktopRadioPopup || !desktopRadioToggle) return;
  if (desktopRadioPopup.classList.contains('is-collapsed')) return;
  if (desktopRadioCollapseTimer) clearTimeout(desktopRadioCollapseTimer);
  desktopRadioPopup.classList.add('is-collapsing');
  desktopRadioPopup.classList.add('is-collapsed');
  desktopRadioToggle.setAttribute('aria-expanded', 'false');
  setDesktopRadioToggleLabel();
  desktopRadioCollapseTimer = setTimeout(() => {
    desktopRadioPopup.classList.remove('is-collapsing');
    desktopRadioCollapseTimer = null;
  }, tabReducedMotion ? 0 : DESKTOP_RADIO_COLLAPSE_MS);
};

const toggleDesktopRadioPopup = () => {
  if (!desktopRadioPopup) return;
  if (desktopRadioPopup.classList.contains('is-collapsed')) {
    expandDesktopRadioPopup();
  } else {
    collapseDesktopRadioPopup();
  }
};

const openMobileRadioPopover = () => {
  if (!mobileRadioToggle || !mobileRadioPopover) return;
  if (mobileRadioCloseTimer) {
    clearTimeout(mobileRadioCloseTimer);
    mobileRadioCloseTimer = null;
  }
  mobileRadioPopover.removeAttribute('hidden');
  mobileRadioPopover.classList.remove('is-closing');
  requestAnimationFrame(() => {
    mobileRadioPopover.classList.add('is-open');
  });
  mobileRadioToggle.setAttribute('aria-expanded', 'true');
  setMobileRadioToggleLabel();
};

const closeMobileRadioPopover = () => {
  if (!mobileRadioToggle || !mobileRadioPopover) return;
  if (mobileRadioPopover.hasAttribute('hidden')) {
    mobileRadioPopover.classList.remove('is-open', 'is-closing');
    mobileRadioToggle.setAttribute('aria-expanded', 'false');
    setMobileRadioToggleLabel();
    return;
  }
  if (mobileRadioCloseTimer) clearTimeout(mobileRadioCloseTimer);
  mobileRadioPopover.classList.remove('is-open');
  mobileRadioPopover.classList.add('is-closing');
  mobileRadioToggle.setAttribute('aria-expanded', 'false');
  setMobileRadioToggleLabel();
  mobileRadioCloseTimer = setTimeout(() => {
    mobileRadioPopover.setAttribute('hidden', '');
    mobileRadioPopover.classList.remove('is-closing');
    mobileRadioCloseTimer = null;
  }, tabReducedMotion ? 0 : RADIO_POPOVER_TRANSITION_MS);
};

const toggleMobileRadioPopover = () => {
  if (!mobileRadioToggle || !mobileRadioPopover) return;
  if (mobileRadioPopover.hasAttribute('hidden') || mobileRadioPopover.classList.contains('is-closing')) {
    openMobileRadioPopover();
  } else {
    closeMobileRadioPopover();
  }
};

const triggerRadioPressFeedback = (button) => {
  if (!button) return;
  const existingTimer = radioPressTimers.get(button);
  if (existingTimer) clearTimeout(existingTimer);
  button.classList.add('is-pressing');
  radioPressTimers.set(button, setTimeout(() => {
    button.classList.remove('is-pressing');
    radioPressTimers.delete(button);
  }, tabReducedMotion ? 0 : RADIO_PRESS_FEEDBACK_MS));
};

const bindRadioPressFeedback = (button) => {
  if (!button) return;
  button.addEventListener('pointerdown', () => triggerRadioPressFeedback(button));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      triggerRadioPressFeedback(button);
    }
  });
};

bindRadioPressFeedback(mobileRadioToggle);
bindRadioPressFeedback(desktopRadioToggle);

mobileRadioToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleMobileRadioPopover();
});

desktopRadioToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleDesktopRadioPopup();
});

desktopRadioClose?.addEventListener('click', (event) => {
  event.stopPropagation();
  collapseDesktopRadioPopup();
});

desktopRadioPopup?.addEventListener('click', (event) => {
  event.stopPropagation();
});

desktopRadioPopup?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', collapseDesktopRadioPopup);
});

mobileRadioPopover?.addEventListener('click', (event) => {
  event.stopPropagation();
});

mobileRadioPopover?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMobileRadioPopover);
});

document.addEventListener('click', () => {
  if (mobileRadioPopover && !mobileRadioPopover.hasAttribute('hidden')) {
    closeMobileRadioPopover();
  }
  collapseDesktopRadioPopup();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMobileRadioPopover();
    collapseDesktopRadioPopup();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 640) closeMobileRadioPopover();
}, { passive: true });

setMobileRadioToggleLabel();
setDesktopRadioToggleLabel();

const getLiveIndicators = () => document.querySelectorAll('[data-live-indicator]');
const getLiveLabels = () => document.querySelectorAll('[data-live-label]');
const hasLiveTargets = () => getLiveIndicators().length || document.querySelector('[data-live-banner]');

const updateLiveIndicator = (isLive) => {
  const state = Boolean(isLive);
  getLiveIndicators().forEach((indicator) => indicator.classList.toggle('is-live', state));
  document.querySelectorAll('[data-live-banner]').forEach((banner) => banner.classList.toggle('is-live', state));

  document.querySelectorAll('[data-live-mobile-toggle]').forEach((button) => {
    button.classList.toggle('is-live', state);
    button.classList.toggle('offline', !state);
  });
  setMobileRadioToggleLabel();
  setDesktopRadioToggleLabel();

  document.querySelectorAll('[data-live-sessions-link]').forEach((link) => {
    const label = link.querySelector('[data-live-sessions-text]');
    if (label) label.textContent = 'Sessions';
  });
  
  getLiveLabels().forEach((label) => {
    label.textContent = state ? 'LIVE NOW' : 'Offline';
  });
  
  // Show/hide "Open radio" button in desktop popup
  const liveRadioBtns = document.querySelectorAll('[data-live-radio-btn]');
  liveRadioBtns.forEach((btn) => {
    btn.style.display = state ? 'flex' : 'none';
    const label = btn.querySelector('[data-live-radio-text]');
    if (label) label.textContent = 'Listen Live';
  });
};

const parseLiveStatus = (payload) => {
  if (!payload || typeof payload !== 'object') return false;
  if ('connected' in payload) return Boolean(payload.connected);
  if ('is_live' in payload) return Boolean(payload.is_live);
  if ('live' in payload) return Boolean(payload.live);
  if (typeof payload.status === 'string') {
    return payload.status.toLowerCase() === 'live';
  }
  if (payload.data) return parseLiveStatus(payload.data);
  return false;
};

// Ordered list of ways to reach the LiveSets endpoint. The first that succeeds
// is remembered and reused, so a single proxy outage no longer breaks the badge.
// `extract` normalizes each proxy's response shape back to the raw status payload.
const buildLiveStatusStrategies = () => {
  const target = `${LIVESETS_STATUS_ENDPOINT}?t=${Date.now()}`;
  const encoded = encodeURIComponent(target);
  const strategies = [];

  if (LIVESETS_PROXY_WORKER) {
    const base = LIVESETS_PROXY_WORKER.endsWith('/')
      ? LIVESETS_PROXY_WORKER
      : `${LIVESETS_PROXY_WORKER}/`;
    strategies.push({
      name: 'worker',
      url: `${base}?t=${Date.now()}`,
      extract: (payload) => payload,
    });
  }

  strategies.push(
    {
      name: 'allorigins',
      url: `https://api.allorigins.win/get?url=${encoded}`,
      // allorigins wraps the upstream body as a JSON string in `contents`.
      extract: (payload) => {
        if (payload && typeof payload.contents === 'string') {
          try {
            return JSON.parse(payload.contents);
          } catch (err) {
            return null;
          }
        }
        return payload;
      },
    },
    {
      name: 'codetabs',
      url: `https://api.codetabs.com/v1/proxy/?quest=${encoded}`,
      extract: (payload) => payload,
    },
  );

  return strategies;
};

// Remember which strategy last worked to avoid retrying dead proxies every poll.
let preferredLiveStrategy = null;

const fetchLiveStatusVia = async (strategy) => {
  const response = await fetch(strategy.url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`${strategy.name} status ${response.status}`);
  const payload = await response.json();
  const status = strategy.extract(payload);
  if (status == null) throw new Error(`${strategy.name} returned no usable payload`);
  return status;
};

// When set to true/false via the console, this pins the live state and stops
// the poll from overriding it. Set back to null to resume automatic polling.
let liveManualOverride = null;

const checkLiveStatus = async () => {
  if (!hasLiveTargets()) return;
  if (liveManualOverride !== null) {
    updateLiveIndicator(liveManualOverride);
    return;
  }

  const strategies = buildLiveStatusStrategies();
  // Try the last known-good strategy first, then the rest.
  const ordered = preferredLiveStrategy
    ? [
        ...strategies.filter((s) => s.name === preferredLiveStrategy),
        ...strategies.filter((s) => s.name !== preferredLiveStrategy),
      ]
    : strategies;

  for (const strategy of ordered) {
    try {
      const status = await fetchLiveStatusVia(strategy);
      preferredLiveStrategy = strategy.name;
      updateLiveIndicator(parseLiveStatus(status));
      return;
    } catch (error) {
      // Try the next proxy in the chain.
      continue;
    }
  }

  preferredLiveStrategy = null;
  console.warn('Unable to fetch LiveSets status from any proxy');
};

// Debug helper: run cidirilkLive(true) / cidirilkLive(false) in the console to
// force the live state, or cidirilkLive(null) to resume automatic polling.
window.cidirilkLive = (state = true) => {
  liveManualOverride = state === null ? null : Boolean(state);
  if (liveManualOverride === null) {
    checkLiveStatus();
  } else {
    updateLiveIndicator(liveManualOverride);
  }
  return liveManualOverride;
};

initTheme();
handleScroll();

// Lazy load LiveSets checking after initial render
if (hasLiveTargets()) {
  // Initial check after a slight delay to not block rendering
  setTimeout(() => {
    checkLiveStatus();
    setInterval(checkLiveStatus, LIVESETS_POLL_INTERVAL);
  }, 1000);
}

// Preload critical resources
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    // Preload hack.chat iframe
    const chatIframe = document.querySelector('.chat-panel iframe');
    if (chatIframe && !chatIframe.src) {
      chatIframe.src = chatIframe.getAttribute('src');
    }
  });
}

// Carousel functionality
const initCarousel = () => {
  const carousel = document.querySelector('[data-carousel]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-carousel-track]');
  const slides = Array.from(track.children);
  const prevBtn = carousel.querySelector('[data-carousel-prev]');
  const nextBtn = carousel.querySelector('[data-carousel-next]');
  const dotsContainer = carousel.querySelector('[data-carousel-dots]');

  let currentIndex = 0;

  // Create dots
  slides.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.classList.add('carousel-dot');
    dot.setAttribute('aria-label', `Go to event ${index + 1}`);
    if (index === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(index));
    dotsContainer.appendChild(dot);
  });

  const dots = Array.from(dotsContainer.children);

  const updateCarousel = () => {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Only the current slide is interactive; neighbours are inert so a single
    // tap can never open more than one link.
    slides.forEach((slide, index) => {
      const isCurrent = index === currentIndex;
      slide.classList.toggle('is-current', isCurrent);
      slide.setAttribute('aria-hidden', String(!isCurrent));
      slide.querySelectorAll('a, button, [tabindex]').forEach((el) => {
        el.tabIndex = isCurrent ? 0 : -1;
      });
    });

    // Update dots
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });

    // Update button states
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === slides.length - 1;
  };

  const goToSlide = (index) => {
    currentIndex = Math.max(0, Math.min(index, slides.length - 1));
    updateCarousel();
  };

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCarousel();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < slides.length - 1) {
      currentIndex++;
      updateCarousel();
    }
  });

  // Keyboard navigation
  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextBtn.click();
    }
  });

  // Touch swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  carousel.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  carousel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        nextBtn.click();
      } else {
        prevBtn.click();
      }
    }
  };

  updateCarousel();
};

// Collaborations Carousel functionality
const initCollabCarousel = () => {
  const carousel = document.querySelector('[data-carousel-collab]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-carousel-track-collab]');
  const slides = Array.from(track.children);
  const prevBtn = carousel.querySelector('[data-carousel-prev-collab]');
  const nextBtn = carousel.querySelector('[data-carousel-next-collab]');
  const dotsContainer = carousel.querySelector('[data-carousel-dots-collab]');

  let currentIndex = 0;

  // Create dots
  slides.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.classList.add('carousel-dot');
    dot.setAttribute('aria-label', `Go to collaboration ${index + 1}`);
    if (index === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(index));
    dotsContainer.appendChild(dot);
  });

  const dots = Array.from(dotsContainer.children);

  const updateCarousel = () => {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Only the current slide is interactive; neighbours are inert so a single
    // tap can never open more than one link.
    slides.forEach((slide, index) => {
      const isCurrent = index === currentIndex;
      slide.classList.toggle('is-current', isCurrent);
      slide.setAttribute('aria-hidden', String(!isCurrent));
      slide.querySelectorAll('a, button, [tabindex]').forEach((el) => {
        el.tabIndex = isCurrent ? 0 : -1;
      });
    });

    // Update dots
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });

    // Update button states
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === slides.length - 1;
  };

  const goToSlide = (index) => {
    currentIndex = Math.max(0, Math.min(index, slides.length - 1));
    updateCarousel();
  };

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCarousel();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < slides.length - 1) {
      currentIndex++;
      updateCarousel();
    }
  });

  // Keyboard navigation
  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextBtn.click();
    }
  });

  // Touch swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  carousel.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  carousel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        nextBtn.click();
      } else {
        prevBtn.click();
      }
    }
  };

  updateCarousel();
};

// Collaboration Modal functionality
const initCollabModal = () => {
  const modal = document.querySelector('[data-collab-modal]');
  const overlay = document.querySelector('[data-collab-modal-overlay]');
  const modalContent = document.querySelector('.collab-modal-content');
  const closeBtn = document.querySelector('[data-collab-modal-close]');
  const modalIcon = document.querySelector('[data-collab-modal-icon]');
  const modalTitle = document.querySelector('[data-collab-modal-title]');
  const modalBody = document.querySelector('[data-collab-modal-body]');
  const collabCards = document.querySelectorAll('[data-collab-id]');
  const modalReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const modalCloseDuration = 320;
  let modalCloseTimer = null;

  if (!modal || !collabCards.length) return;

  const resetModalScroll = () => {
    [modal, modalContent, modalBody].forEach((element) => {
      if (!element) return;
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
  };

  const focusCloseButton = () => {
    try {
      closeBtn?.focus({ preventScroll: true });
    } catch (e) {
      closeBtn?.focus();
    }
  };

  // Collaboration data
  const collabData = {
    chacha: {
      icon: 'fa-users',
      title: 'ChaCha',
      content: `
        <h3>About ChaCha</h3>
        <p>ChaCha is an artist project that explores the space between techno, electronica, and experimental sound design, creating immersive sonic landscapes that balance structure with spontaneity.</p>
        
        <h3>Musical Approach</h3>
        <p>The project emphasizes <strong>textural depth</strong> and <strong>rhythmic exploration</strong>, weaving together hypnotic patterns with unexpected sonic moments. ChaCha's sets range from introspective ambient passages to driving techno rhythms.</p>
        
        <h3>Performance Style</h3>
        <ul>
          <li>Live hardware-based performances with modular synthesis</li>
          <li>Real-time manipulation of sound and texture</li>
          <li>Improvised sequences and generative patterns</li>
          <li>Focus on creating immersive, evolving soundscapes</li>
        </ul>
        
        <h3>Links</h3>
        <p>More info: <a href="https://ra.co/dj/chacha/biography" target="_blank" rel="noopener">Resident Advisor Profile</a></p>
      `
    },
    synesthesia: {
      icon: 'fa-brain',
      title: 'SYNESTHESIA',
      content: `
        <h3>About SYNESTHESIA</h3>
        <p>SYNESTHESIA is a cutting-edge collective focused on merging electronic music with multisensory experiences, creating events that blur the boundaries between sound, vision, and sensation.</p>
        
        <h3>Philosophy</h3>
        <p>The collective explores how different sensory inputs can enhance and transform the music experience, creating environments where attendees don't just hear the music—they feel it on multiple levels.</p>
        
        <h3>Events & Performances</h3>
        <ul>
          <li>Immersive audiovisual showcases</li>
          <li>Underground warehouse parties with spatial audio</li>
          <li>Experimental electronic music lineups</li>
          <li>Collaborative performances with visual artists</li>
        </ul>
        
        <h3>Links</h3>
        <p>More info: <a href="https://ra.co/promoters/115743" target="_blank" rel="noopener">Resident Advisor Profile</a></p>
      `
    },
    mindriot: {
      icon: 'fa-bolt',
      title: 'Mind The Riot',
      content: `
        <h3>About Mind The Riot</h3>
        <p>Mind The Riot is a dynamic promoter collective bringing high-energy techno and underground electronic music to unconventional spaces, fostering a community of passionate music lovers.</p>
        
        <h3>Mission</h3>
        <p>Creating memorable nights that challenge the status quo, Mind The Riot focuses on showcasing both established and emerging talent in raw, authentic environments.</p>
        
        <h3>Event Focus</h3>
        <ul>
          <li>Underground techno and hard groove</li>
          <li>Industrial and warehouse venues</li>
          <li>Local and international artist bookings</li>
          <li>Community-driven music culture</li>
        </ul>
        
        <h3>Links</h3>
        <p>More info: <a href="https://ra.co/promoters/106564" target="_blank" rel="noopener">Resident Advisor Profile</a></p>
      `
    },
    boilerhouse: {
      icon: 'fa-fire',
      title: 'Boiler House',
      content: `
        <h3>About Boiler House</h3>
        <p>Boiler House is a respected promoter known for curating forward-thinking electronic music events, featuring everything from deep house to experimental techno in carefully selected venues.</p>
        
        <h3>Event Curation</h3>
        <p>With a focus on quality over quantity, Boiler House creates intimate yet powerful experiences, bringing together diverse sounds and talented selectors for nights that stay with you.</p>
        
        <h3>Musical Range</h3>
        <ul>
          <li>Deep house and melodic techno</li>
          <li>Experimental electronic soundscapes</li>
          <li>Carefully curated DJ lineups</li>
          <li>Emphasis on dancefloor energy and musicality</li>
        </ul>
        
        <h3>Links</h3>
        <p>More info: <a href="https://ra.co/promoters/102310" target="_blank" rel="noopener">Resident Advisor Profile</a></p>
      `
    },
    indigo: {
      icon: 'fa-circle-half-stroke',
      title: 'Indigo',
      content: `
        <h3>About Indigo</h3>
        <p>Indigo is a forward-thinking collective that champions progressive electronic music, creating atmospheric events that emphasize musical journey and emotional depth.</p>
        
        <h3>Vision</h3>
        <p>Named after the color between blue and violet, Indigo represents the liminal space in electronic music—the transition between moods, genres, and energies throughout a night.</p>
        
        <h3>Event Style</h3>
        <ul>
          <li>Progressive and melodic techno</li>
          <li>Deep and hypnotic house music</li>
          <li>Focus on musical narrative and flow</li>
          <li>Intimate venue selections with quality sound systems</li>
        </ul>
        
        <h3>Links</h3>
        <p>More info: <a href="https://ra.co/promoters/129207" target="_blank" rel="noopener">Resident Advisor Profile</a></p>
      `
    }
  };

  // Open modal function
  const openModal = (collabId) => {
    const data = collabData[collabId];
    if (!data) return;

    if (modalCloseTimer) {
      clearTimeout(modalCloseTimer);
      modalCloseTimer = null;
    }

    // Update modal content
    modalIcon.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
    modalTitle.textContent = data.title;
    modalBody.innerHTML = data.content;
    resetModalScroll();

    // Show modal
    modal.classList.remove('is-closing');
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(resetModalScroll);
    
    // Focus the close button for accessibility
    setTimeout(focusCloseButton, 100);
  };

  // Close modal function
  const closeModal = () => {
    if (modal.hasAttribute('hidden') || modal.classList.contains('is-closing')) return;

    const hideModal = () => {
      modal.setAttribute('hidden', '');
      modal.classList.remove('is-closing');
      document.body.style.overflow = '';
      modalCloseTimer = null;
    };

    if (modalReducedMotion) {
      hideModal();
      return;
    }

    modal.classList.add('is-closing');
    modalCloseTimer = setTimeout(hideModal, modalCloseDuration);
  };

  // Add click listeners to collab cards
  collabCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const collabId = card.getAttribute('data-collab-id');
      openModal(collabId);
    });
    
    // Add keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const collabId = card.getAttribute('data-collab-id');
        openModal(collabId);
      }
    });
  });

  // Close button
  closeBtn?.addEventListener('click', closeModal);

  // Overlay click
  overlay?.addEventListener('click', closeModal);

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
      closeModal();
    }
  });
};

// Build an archive carousel slide from the expired "next event" card so the
// past-events list stays current without manual edits once the date passes.
const buildArchiveSlideFromNextEvent = (eventCard, eventEndTime) => {
  const link =
    eventCard.querySelector('.upcoming-event-footer a[href]')?.getAttribute('href') ||
    '';
  if (!link) return null;

  const raId = (link.match(/events\/(\d+)/) || [])[1] || '';
  const tagText = eventCard.querySelector('.upcoming-event-tag')?.textContent.trim() || '';
  const isChaCha = tagText.toLowerCase().includes('chacha');
  const name = eventCard.querySelector('.upcoming-event-title')?.textContent.trim() || '';
  const venueHTML = eventCard.querySelector('.upcoming-event-venue')?.innerHTML.trim() || '';

  const day = eventCard.querySelector('.date-day')?.textContent.trim() || '';
  const monthRaw = eventCard.querySelector('.date-month')?.textContent.trim() || '';
  const month = monthRaw
    ? monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1).toLowerCase()
    : '';
  const year = eventEndTime.getFullYear();
  const dateText = [day, month, year].filter(Boolean).join(' ');

  const slide = document.createElement('div');
  slide.className = 'carousel-slide';
  if (raId) slide.dataset.archivedFrom = `RA${raId}`;
  slide.innerHTML = `
    <a href="${link}" target="_blank" rel="noopener" class="event-link">
      <span class="event-top">
        <span class="event-tag${isChaCha ? ' chacha' : ''}">${tagText}</span>
        <span class="event-date">${dateText}</span>
      </span>
      <span class="event-name">${name}</span>
      <span class="event-venue">${venueHTML}</span>
      ${raId ? `<span class="event-id">RA${raId}</span>` : ''}
    </a>
  `;
  return slide;
};

// Check and hide expired events. Once the next event's date passes, hide the
// "Next Event" block and move that event to the top of the past-events archive.
const checkEventExpiry = () => {
  const eventContainer = document.querySelector('[data-next-event-container]');
  const eventCard = document.querySelector('[data-event-end]');
  const socialHeading = document.querySelector('[data-social-heading]');
  const socialLinks = document.querySelector('.socials-card .social-links');

  if (!eventContainer || !eventCard) return;

  const endDate = eventCard.getAttribute('data-event-end');

  if (!endDate) return;

  const eventEndTime = new Date(endDate);
  const now = new Date();

  if (now > eventEndTime) {
    eventContainer.style.display = 'none';
    // With no upcoming event to anchor the panel, label the social row and
    // expand it into a vertical list with each platform name shown.
    if (socialHeading) socialHeading.hidden = false;
    if (socialLinks) socialLinks.classList.add('is-stacked');

    // Promote the finished event into the archive carousel (deduped by RA id).
    const track = document.querySelector('[data-carousel-track]');
    if (track) {
      const raId = (
        eventCard
          .querySelector('.upcoming-event-footer a[href]')
          ?.getAttribute('href')
          .match(/events\/(\d+)/) || []
      )[1];
      const alreadyArchived = Array.from(track.querySelectorAll('.event-id')).some(
        (el) => raId && el.textContent.trim() === `RA${raId}`
      );
      if (!alreadyArchived) {
        const slide = buildArchiveSlideFromNextEvent(eventCard, eventEndTime);
        if (slide) track.insertBefore(slide, track.firstElementChild);
      }
    }
  } else {
    eventContainer.style.display = 'block';
    if (socialHeading) socialHeading.hidden = true;
    if (socialLinks) socialLinks.classList.remove('is-stacked');
  }
};

// Pointer-aware micro-interactions (spotlight on glass cards).
// Kept lightweight: only on fine pointers and when motion is allowed.
const initInteractions = () => {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (prefersReducedMotion || !finePointer) return;

  // Cursor-following spotlight on glass cards.
  const cards = document.querySelectorAll('.info-card');
  cards.forEach((card) => {
    let frame = null;
    card.addEventListener('pointermove', (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${x}%`);
        card.style.setProperty('--my', `${y}%`);
        frame = null;
      });
    });
  });
};

// Initialize carousel after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    checkEventExpiry();
    initCarousel();
    initCollabCarousel();
    initCollabModal();
    initInteractions();
  });
} else {
  checkEventExpiry();
  initCarousel();
  initCollabCarousel();
  initCollabModal();
  initInteractions();
}
