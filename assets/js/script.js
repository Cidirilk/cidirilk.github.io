const subscribeForm = document.querySelector('[data-subscribe-inline]');
const subscribeStatus = document.querySelector('.subscribe-inline-status');
const tabButtons = document.querySelectorAll('[data-tab]');
const tabPanels = document.querySelectorAll('[data-panel]');
const TAB_COOKIE = 'cidirilkActiveTab';
const root = document.documentElement;
const header = document.getElementById('siteHeader');
const themeToggle = document.querySelector('.theme-toggle');
const yearEl = document.getElementById('year');
const LIVESETS_STATUS_ENDPOINT = 'https://livesets.com/app/polling/live/42069';
const LIVESETS_PROXY = 'https://corsproxy.io/?';
const LIVESETS_POLL_INTERVAL = 15000;
const chatToggles = document.querySelectorAll('[data-chat-toggle]');
const chatPanel = document.querySelector('[data-chat-panel]');
const chatClose = document.querySelector('[data-chat-close]');
const pageLoader = document.querySelector('[data-page-loader]');
const loaderEnter = document.querySelector('[data-loader-enter]');
const loaderMessage = document.querySelector('[data-loader-message]');
const loaderMessages = [
  'Click anywhere to enter.',
  'Scanning rave memory...',
  'Syncing LiveSets telemetry...',
  'Tuning DSP ghosts...',
  'Warming transceivers...'
];
let loaderMessageTimer = null;

const markBodyLoaded = () => document.body?.classList.add('is-loaded');

const completeLoader = () => {
  if (document.body?.classList.contains('loader-complete')) return;
  markBodyLoaded();
  document.body?.classList.add('loader-complete');
  pageLoader?.setAttribute('aria-hidden', 'true');
  if (loaderMessageTimer) {
    clearInterval(loaderMessageTimer);
    loaderMessageTimer = null;
  }
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

loaderEnter?.addEventListener('click', handleLoaderEnter);
pageLoader?.addEventListener('click', handleLoaderOverlayClick);

const startLoaderMessages = () => {
  if (!loaderMessage || loaderMessages.length <= 1) return;
  let index = 0;
  loaderMessage.textContent = loaderMessages[index];
  loaderMessageTimer = setInterval(() => {
    index = (index + 1) % loaderMessages.length;
    loaderMessage.textContent = loaderMessages[index];
  }, 2600);
};

startLoaderMessages();

const setCookie = (name, value, days = 60) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
};

const getCookie = (name) =>
  document.cookie
    .split('; ')
    .map((row) => row.split('='))
    .reduce((acc, [key, val]) => (key === name ? decodeURIComponent(val) : acc), null);

const setActiveTab = (target, persist = true) => {
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
};

if (tabButtons.length && tabPanels.length) {
  const saved = getCookie(TAB_COOKIE);
  const defaultTab = saved && [...tabPanels].some((panel) => panel.getAttribute('data-panel') === saved) ? saved : 'social';
  setActiveTab(defaultTab, false);
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-tab');
      setActiveTab(target);
    });
  });
}

subscribeForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(subscribeForm);
  const email = formData.get('subEmail');
  if (!email) return;
  subscribeStatus.textContent = 'Thanks! I will send notes soon.';
  subscribeForm.reset();
});

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
};

const initTheme = () => {
  const stored = localStorage.getItem('theme');
  if (stored) {
    root.setAttribute('data-theme', stored);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    root.setAttribute('data-theme', 'light');
  }
  syncThemeIcon();
};

const toggleTheme = () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  setTheme(next);
};

const handleScroll = () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 30);
};

const openChat = () => chatPanel?.classList.add('is-open');
const closeChat = () => chatPanel?.classList.remove('is-open');

chatToggles.forEach((toggle) =>
  toggle.addEventListener('click', () => {
    if (chatPanel?.classList.contains('is-open')) {
      closeChat();
    } else {
      openChat();
    }
  })
);

chatClose?.addEventListener('click', closeChat);

themeToggle?.addEventListener('click', toggleTheme);
window.addEventListener('scroll', handleScroll);
window.addEventListener('resize', handleScroll);

const getLiveIndicators = () => document.querySelectorAll('[data-live-indicator]');
const getLiveLabels = () => document.querySelectorAll('[data-live-label]');
const hasLiveTargets = () => getLiveIndicators().length || document.querySelector('[data-live-banner]');

const updateLiveIndicator = (isLive) => {
  const state = Boolean(isLive);
  getLiveIndicators().forEach((indicator) => indicator.classList.toggle('is-live', state));
  document.querySelectorAll('[data-live-banner]').forEach((banner) => banner.classList.toggle('is-live', state));
  document.querySelectorAll('.live-mobile-link').forEach((link) => {
    link.classList.toggle('offline', !state);
  });
  getLiveLabels().forEach((label) => {
    label.textContent = state ? 'LIVE NOW' : 'Offline';
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

const buildLiveStatusUrl = () => {
  const bust = Date.now();
  return `${LIVESETS_PROXY}${encodeURIComponent(`${LIVESETS_STATUS_ENDPOINT}?t=${bust}`)}`;
};

const checkLiveStatus = async () => {
  if (!hasLiveTargets()) return;
  try {
    const response = await fetch(buildLiveStatusUrl(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const payload = await response.json();
    updateLiveIndicator(parseLiveStatus(payload));
  } catch (error) {
    console.warn('Unable to fetch LiveSets status', error);
  }
};

initTheme();
handleScroll();
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}
if (hasLiveTargets()) {
  checkLiveStatus();
  setInterval(checkLiveStatus, LIVESETS_POLL_INTERVAL);
}
