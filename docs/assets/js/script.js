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
const soundCloudSourcePlayers = document.querySelectorAll('[data-soundcloud-source]');
const soundCloudEpisodeLists = document.querySelectorAll('[data-soundcloud-episodes]');
const podcastCarouselPrev = document.querySelector('[data-podcast-prev]');
const podcastCarouselNext = document.querySelector('[data-podcast-next]');
const podcastCarouselDots = document.querySelector('[data-podcast-dots]');
const liveSetsSessionLists = document.querySelectorAll('[data-livesets-sessions]');
const liveSetsCarouselPrev = document.querySelector('[data-livesets-prev]');
const liveSetsCarouselNext = document.querySelector('[data-livesets-next]');
const liveSetsCarouselDots = document.querySelector('[data-livesets-dots]');
const youtubeVideoLists = document.querySelectorAll('[data-youtube-videos]');
const youtubeCarouselPrev = document.querySelector('[data-youtube-prev]');
const youtubeCarouselNext = document.querySelector('[data-youtube-next]');
const youtubeCarouselDots = document.querySelector('[data-youtube-dots]');
const yearEl = document.getElementById('year');
const LIVESETS_STATUS_ENDPOINT = 'https://livesets.com/app/polling/live/42069';
const LIVESETS_SESSIONS_URL = 'https://livesets.com/cidirilk/sessions';
const LIVESETS_POLL_INTERVAL = 15000;
const MEDIA_CAROUSEL_LIMIT = 10;
const PODCAST_DOT_WINDOW = MEDIA_CAROUSEL_LIMIT;
const LIVESETS_DOT_WINDOW = MEDIA_CAROUSEL_LIMIT;
const YOUTUBE_DOT_WINDOW = 8;
// Preferred proxy: your own Cloudflare Worker (see livesets-proxy-worker.js).
// Once deployed, set this to the worker URL, e.g. 'https://livesets-proxy.<you>.workers.dev/'.
// The worker is the durable long-term path; public proxies below are only fallbacks.
const LIVESETS_PROXY_WORKER = 'https://livesets-proxy.cidirilk.workers.dev/';
const chatToggles = document.querySelectorAll('[data-chat-toggle]');
const chatPanel = document.querySelector('[data-chat-panel]');
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
const initialHash = window.location.hash;
const shouldPreserveInitialHash = initialHash === '#dj-guides';
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
if (!shouldPreserveInitialHash) {
  window.scrollTo(0, 0);
}

const markBodyLoaded = () => document.body?.classList.add('is-loaded');

function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.closest('[hidden], [aria-hidden="true"], [inert]'));
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setCardDescendantFocusability(card, active) {
  card.inert = !active;
  card.querySelectorAll('a[href], button, input, select, textarea, iframe, [tabindex]').forEach((element) => {
    if (!active) {
      if (!Object.prototype.hasOwnProperty.call(element.dataset, 'inactiveTabindex')) {
        element.dataset.inactiveTabindex = element.getAttribute('tabindex') || '';
      }
      element.tabIndex = -1;
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(element.dataset, 'inactiveTabindex')) return;
    const previousTabindex = element.dataset.inactiveTabindex;
    if (previousTabindex) element.setAttribute('tabindex', previousTabindex);
    else element.removeAttribute('tabindex');
    delete element.dataset.inactiveTabindex;
  });
}

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
  
  // Ensure page starts at top (fixes Android scroll issue) unless opening a
  // shareable guide hash.
  setTimeout(() => {
    if (!shouldPreserveInitialHash) {
      window.scrollTo(0, 0);
      document.querySelector('main')?.scrollTo(0, 0);
    }
    window.dispatchEvent(new CustomEvent('cidirilk:loadercomplete'));
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
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
};

const getCookie = (name) =>
  document.cookie
    .split('; ')
    .map((row) => row.split('='))
    .reduce((acc, [key, val]) => (key === name ? decodeURIComponent(val) : acc), null);

const tabPanelsWrap = tabPanels[0]?.closest('.tab-panels') || null;
const tabReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tabMobileQuery = window.matchMedia('(max-width: 1024px)');

// Desktop console (>=1025px): the Gigs, Collabs, Artifacts and Guides
// carousels are laid out as static lists/grids by redesign.css, so every real
// slide must stay focusable and visible to assistive tech. Clones stay hidden.
const consoleListQuery = window.matchMedia('(min-width: 1025px)');
const setConsoleListSlides = (track) => {
  if (!track) return;
  track.style.transform = 'none';
  Array.from(track.children).forEach((slide) => {
    const isClone = slide.dataset.carouselClone === 'true';
    slide.classList.toggle('is-current', !isClone);
    slide.setAttribute('aria-hidden', String(isClone));
    slide.querySelectorAll('a, button, [tabindex]').forEach((el) => {
      el.tabIndex = isClone ? -1 : 0;
    });
  });
};
const mobileSectionLinks = [...document.querySelectorAll('[data-mobile-section]')].map((link) => ({
  link,
  href: link.getAttribute('href'),
  target: link.getAttribute('target'),
  label: link.getAttribute('aria-label'),
  iconClass: link.querySelector('i')?.className,
}));

const syncMobileSectionLinks = () => {
  mobileSectionLinks.forEach(({ link, href, target, label, iconClass }) => {
    const mobile = tabMobileQuery.matches;
    const currentLabel = mobile ? link.dataset.mobileLabel : label;
    link.setAttribute('href', mobile ? `#${link.dataset.mobileSection}` : href);
    if (mobile || !target) link.removeAttribute('target');
    else link.setAttribute('target', target);
    link.setAttribute('aria-label', currentLabel);
    link.setAttribute('title', currentLabel);
    const text = link.querySelector('.sr-only');
    if (text) text.textContent = currentLabel;
    const icon = link.querySelector('i');
    if (icon && iconClass) {
      icon.className = mobile && link.dataset.mobileIcon ? link.dataset.mobileIcon : iconClass;
    }
  });
};
let tabHeightTimer = null;
let fitTurnstile = () => {};
let podcastTrackCount = 0;

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

// Default console tab: always Sessions (music first). Upcoming events live in
// the Gigs tab, so the landing tab no longer depends on the event date.
function getDefaultTab() {
  return 'sessions';
}

const setActiveTab = (target, persist = true, animate = false) => {
  if (tabMobileQuery.matches) return;
  // Tabs hidden on desktop (Channels lives in the mobile bottom nav only)
  // fall back to the default panel, e.g. when restored from the tab cookie
  if ([...tabButtons].some((btn) => btn.hidden && btn.getAttribute('data-tab') === target)) {
    target = getDefaultTab();
  }

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
  window.dispatchEvent(new CustomEvent('cidirilk:tabchange', { detail: { target } }));
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
  syncMobileSectionLinks();
  if (!tabButtons.length || !tabPanels.length) return;

  if (tabMobileQuery.matches) {
    showMobileTabSections();
    return;
  }

  const current =
    [...tabButtons].find((button) => button.classList.contains('active'))?.getAttribute('data-tab') ||
    getCookie(TAB_COOKIE) ||
    getDefaultTab();
  const hasPanel = [...tabPanels].some((panel) => panel.getAttribute('data-panel') === current);
  setActiveTab(hasPanel ? current : getDefaultTab(), false);
};

if (tabButtons.length && tabPanels.length) {
  syncMobileSectionLinks();
  const saved = getCookie(TAB_COOKIE);
  const hashTab = shouldPreserveInitialHash ? 'guides' : '';
  const defaultTab =
    hashTab ||
    (saved && [...tabPanels].some((panel) => panel.getAttribute('data-panel') === saved) ? saved : getDefaultTab());
  if (tabMobileQuery.matches) {
    showMobileTabSections();
  } else {
    setActiveTab(defaultTab, false);
  }
  
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-tab');
      setActiveTab(target, true, true);
    });
    
    // Add keyboard navigation for tabs (skips tabs hidden on desktop)
    button.addEventListener('keydown', (e) => {
      const visibleTabs = [...tabButtons].filter((btn) => !btn.hidden);
      const current = visibleTabs.indexOf(button);
      let newIndex = current;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = (current + 1) % visibleTabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = (current - 1 + visibleTabs.length) % visibleTabs.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        newIndex = visibleTabs.length - 1;
      } else {
        return;
      }

      visibleTabs[newIndex].focus();
      const target = visibleTabs[newIndex].getAttribute('data-tab');
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
    if (subscribeLabel) subscribeLabel.textContent = 'Join the Signal';
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
let turnstileWidgetTheme = null;
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
  // Hidden desktop tabs and offscreen mobile forms do not need a running
  // challenge. Start near the form so verification can finish before submit.
  const wrap = el.closest('.subscribe-turnstile');
  if (!wrap || !wrap.getClientRects().length) return;
  const bounds = wrap.getBoundingClientRect();
  if (bounds.bottom < -200 || bounds.top > window.innerHeight + 200) return;
  const theme = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  if (turnstileWidgetId !== null && turnstileWidgetTheme === theme) {
    fitTurnstile();
    return;
  }
  if (turnstileWidgetId !== null) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch (e) {}
    turnstileWidgetId = null;
  }
  turnstileWidgetId = window.turnstile.render(el, {
    sitekey: getTurnstileSitekey(el),
    action: el.dataset.action,
    theme,
    size: 'flexible',
  });
  turnstileWidgetTheme = theme;
  fitTurnstile();
  // The widget iframe sizes itself shortly after render; refit once it's ready.
  setTimeout(fitTurnstile, 300);
};

// Cloudflare's api.js invokes this once it has finished loading.
window.onloadTurnstile = renderTurnstile;
// Tab changes reveal the desktop form; intersection handles mobile scrolling
// and also picks up a deferred theme change when the form returns into view.
window.addEventListener('cidirilk:tabchange', () => requestAnimationFrame(renderTurnstile));
window.addEventListener('resize', () => requestAnimationFrame(renderTurnstile), { passive: true });
const turnstileWrap = document.querySelector('.subscribe-turnstile');
if (turnstileWrap && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) renderTurnstile();
  }, { rootMargin: '200px 0px' });
  observer.observe(turnstileWrap);
} else {
  window.addEventListener('scroll', renderTurnstile, { passive: true });
}
renderTurnstile();

const syncThemeIcon = () => {
  const themeIcon = document.querySelector('.theme-icon');
  if (!themeIcon) return;
  const theme = root.getAttribute('data-theme') || 'dark';
  themeIcon.className = theme === 'light' ? 'theme-icon fa-solid fa-moon' : 'theme-icon fa-solid fa-sun';
};

const buildSoundCloudPlayerSrc = (sourceUrl, trackIndex = 0, usePlaylistIndex = true) => {
  const theme = root.getAttribute('data-theme') || 'dark';
  const params = new URLSearchParams({
    url: sourceUrl,
    color: theme === 'light' ? '#9b45ff' : '#c174ff',
    auto_play: 'false',
    hide_related: 'true',
    show_comments: 'false',
    show_playcount: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'false',
    show_artwork: 'false',
    visual: 'false',
  });
  if (usePlaylistIndex) {
    params.set('start_track', String(trackIndex));
  }
  return `https://w.soundcloud.com/player/?${params.toString()}`;
};

const loadSoundCloudSourcePlayers = () => {
  soundCloudSourcePlayers.forEach((frame) => {
    if (frame.getAttribute('src')) return;
    const sourceUrl = String(frame.dataset.soundcloudUrl || '').trim();
    if (!sourceUrl) return;
    const trackIndex = Number.parseInt(frame.dataset.soundcloudTrackIndex || '0', 10);
    frame.setAttribute('src', buildSoundCloudPlayerSrc(sourceUrl, Number.isNaN(trackIndex) ? 0 : trackIndex));
  });
};

const releaseSoundCloudSourcePlayers = () => {
  soundCloudSourcePlayers.forEach((frame) => {
    frame.removeAttribute('src');
  });
};

const renderSoundCloudEpisodeStatus = (message, isLoading = false) => {
  soundCloudEpisodeLists.forEach((list) => {
    list.style.transform = '';
    list.replaceChildren();
    const status = document.createElement('span');
    status.className = `podcast-episodes-status${isLoading ? ' is-loading' : ''}`;
    if (isLoading) {
      const spinner = document.createElement('span');
      spinner.className = 'podcast-loading-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      status.appendChild(spinner);
    }
    const text = document.createElement('span');
    text.textContent = message;
    status.appendChild(text);
    list.appendChild(status);
  });
};

const finishPodcastPreviewLoad = (player) => {
  if (!player) return;
  if (player.classList.contains('is-preview-ready')) return;
  const startedAt = Number.parseInt(player.dataset.previewStartedAt || '0', 10);
  const elapsed = Date.now() - (Number.isNaN(startedAt) ? 0 : startedAt);
  const delay = Math.max(0, 650 - elapsed);
  setTimeout(() => {
    player.classList.remove('is-loading-preview');
    player.classList.add('is-preview-ready');
  }, delay);
};

const preparePodcastCardFrame = (card, player, iframe) => {
  iframe.addEventListener('load', () => finishPodcastPreviewLoad(player), { once: true });
  // Our own player UI drives the visually hidden SoundCloud widget. This
  // listener intentionally runs for every fresh iframe, not just the first card visit.
  iframe.addEventListener('load', () => bindPodcastWidget(card));
};

const loadPodcastCardPlayer = (card) => {
  const player = card?.querySelector('[data-soundcloud-card-player]');
  const iframe = card?.querySelector('[data-soundcloud-card-frame]');
  if (!iframe) return;
  if (!player?.isConnected || !player.clientWidth) return;
  if (iframe.getAttribute('src') && iframe.getAttribute('src') !== 'about:blank') {
    if (!card._podcastWidget) bindPodcastWidget(card);
    finishPodcastPreviewLoad(player);
    return;
  }
  const src = iframe.dataset.soundcloudSrc;
  if (src) {
    player?.classList.remove('is-unloaded', 'is-preview-ready');
    player?.classList.add('is-loading-preview');
    if (player) player.dataset.previewStartedAt = String(Date.now());
    // The widget is visually hidden behind our own controls: keep it out of the tab order
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('src', src);
    setTimeout(() => finishPodcastPreviewLoad(player), 2600);
  }
};

const unloadPodcastCardPlayer = (card) => {
  const player = card?.querySelector('[data-soundcloud-card-player]');
  const iframe = card?.querySelector('[data-soundcloud-card-frame]');
  if (!iframe) return;
  // A SoundCloud Widget is not reliably reusable after its iframe has been
  // sent to about:blank. Recreate the hidden frame for the next card visit.
  const replacement = iframe.cloneNode(false);
  replacement.removeAttribute('src');
  replacement.tabIndex = -1;
  replacement.setAttribute('aria-hidden', 'true');
  preparePodcastCardFrame(card, player, replacement);
  iframe.replaceWith(replacement);
  resetPodcastControls(card);
  player?.classList.remove('is-loading-preview', 'is-preview-ready');
  player?.classList.add('is-unloaded');
  if (player) delete player.dataset.previewStartedAt;
};

const pendingPeekCarouselWraps = new WeakMap();

const setPeekCarouselPosition = (track, slide, instant = false, wrapDirection = 0) => {
  if (!track || !slide) return;
  pendingPeekCarouselWraps.get(track)?.();
  const disableAnimation = instant || tabReducedMotion;
  const positionSlide = (target, skipAnimation) => {
    const targetLeft = target.offsetLeft - (track.clientWidth - target.offsetWidth) / 2;
    if (skipAnimation) track.style.transition = 'none';
    const useLayoutPosition = track.matches('[data-soundcloud-episodes], [data-chacha-episodes]') && tabMobileQuery.matches;
    track.style.left = useLayoutPosition ? `${-targetLeft}px` : '';
    track.style.transform = useLayoutPosition ? 'none' : `translateX(-${targetLeft}px)`;
    if (skipAnimation) {
      void track.offsetHeight;
      track.style.transition = '';
    }
  };
  const clone = wrapDirection > 0 ? track.lastElementChild : track.firstElementChild;
  if (!wrapDirection || disableAnimation || !clone?.hasAttribute('aria-hidden')) {
    positionSlide(slide, disableAnimation);
    return;
  }

  // Cross the boundary using the adjacent clone, then silently return to the real card.
  positionSlide(clone, false);
  const finishWrap = () => {
    if (pendingPeekCarouselWraps.get(track) !== finishWrap) return;
    pendingPeekCarouselWraps.delete(track);
    positionSlide(slide, true);
  };
  pendingPeekCarouselWraps.set(track, finishWrap);
  const transition = track.getAnimations().find((animation) => ['transform', 'left'].includes(animation.transitionProperty));
  if (transition) {
    transition.finished.then(finishWrap, finishWrap);
  } else {
    finishWrap();
  }
};

const refreshMediaCarouselPositions = () => {
  [...soundCloudEpisodeLists, ...document.querySelectorAll('[data-chacha-episodes]'), ...liveSetsSessionLists, ...youtubeVideoLists].forEach((list) => {
    if (!list.clientWidth) return;
    const activeCard = list.querySelector('[aria-current="true"]');
    if (activeCard) setPeekCarouselPosition(list, activeCard.parentElement, true);
  });
};

window.addEventListener('cidirilk:tabchange', refreshMediaCarouselPositions);
window.addEventListener('resize', () => requestAnimationFrame(refreshMediaCarouselPositions), { passive: true });

const setActiveSoundCloudTrack = (trackIndex, options = {}) => {
  soundCloudSourcePlayers.forEach((frame) => {
    frame.dataset.soundcloudTrackIndex = String(trackIndex);
  });
  renderPodcastCarouselDots(podcastTrackCount, trackIndex);
  soundCloudEpisodeLists.forEach((list) => {
    list.querySelectorAll('.podcast-episode[data-soundcloud-track]').forEach((card) => {
      const active = Number.parseInt(card.dataset.soundcloudTrack || '0', 10) === trackIndex;
      card.classList.toggle('active', active);
      card.setAttribute('aria-current', active ? 'true' : 'false');
      card.tabIndex = active ? 0 : -1;
      setCardDescendantFocusability(card, active);
      if (active) {
        loadPodcastCardPlayer(card);
      } else {
        unloadPodcastCardPlayer(card);
      }
      if (active) {
        setPeekCarouselPosition(list, card.closest('.podcast-slide'), Boolean(options.instant), options.wrapDirection);
      }
    });
  });
};

const renderPodcastCarouselDots = (count, activeIndex = getActivePodcastTrackIndex()) => {
  if (!podcastCarouselDots) return;
  podcastTrackCount = count;
  const visibleCount = Math.min(count, PODCAST_DOT_WINDOW);
  const startIndex = Math.max(0, Math.min(activeIndex - Math.floor(visibleCount / 2), count - visibleCount));

  podcastCarouselDots.replaceChildren();
  Array.from({ length: visibleCount }).forEach((_, dotIndex) => {
    const index = startIndex + dotIndex;
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.type = 'button';
    dot.classList.toggle('active', index === activeIndex);
    dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    dot.setAttribute('aria-label', `Go to monthly dose episode ${index + 1}`);
    dot.addEventListener('click', () => setActiveSoundCloudTrack(index));
    podcastCarouselDots.appendChild(dot);
  });
};

const getPodcastEpisodeButtons = () =>
  [...document.querySelectorAll('.podcast-episode[data-soundcloud-track]')];

const getActivePodcastTrackIndex = () => {
  const current = getPodcastEpisodeButtons().find(
    (button) => button.getAttribute('aria-current') === 'true'
  );
  const trackIndex = Number.parseInt(current?.dataset.soundcloudTrack || '0', 10);
  return Number.isNaN(trackIndex) ? 0 : trackIndex;
};

const movePodcastCarousel = (direction) => {
  const buttons = getPodcastEpisodeButtons();
  if (!buttons.length) return;
  const currentIndex = getActivePodcastTrackIndex();
  const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
  const wrapsAround =
    (direction < 0 && currentIndex === 0) ||
    (direction > 0 && currentIndex === buttons.length - 1);
  setActiveSoundCloudTrack(nextIndex, { wrapDirection: wrapsAround ? direction : 0 });
};

const formatPodcastEpisodeLabel = (track) => {
  const title = String(track?.title || '').trim();
  const episodeMatch = title.match(/#\s*(\d+)/);
  if (episodeMatch) return `#${episodeMatch[1].padStart(3, '0')}`;
  return 'Episode';
};

const formatPodcastEpisodeTitle = () => {
  return 'Your Monthly Dose';
};

const getSoundCloudTrackUrl = (track) => {
  const permalinkUrl = String(track?.permalink_url || '').trim();
  if (permalinkUrl) return permalinkUrl;
  const trackId = String(track?.id || '').trim();
  return /^\d+$/.test(trackId) ? `https://api.soundcloud.com/tracks/${trackId}` : '';
};

const resolveSoundCloudEpisode = async (track, trackIndex) => {
  const episode = {
    ...track,
    trackIndex: Number.isInteger(track?.trackIndex) ? track.trackIndex : trackIndex,
  };
  const trackUrl = getSoundCloudTrackUrl(episode);
  if (String(episode.title || '').trim() || !trackUrl) return episode;

  try {
    const response = await fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trackUrl)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return episode;
    const metadata = await response.json();
    episode.title = String(metadata?.title || '').trim();
  } catch (e) {}
  return episode;
};

const PODCAST_ARTWORK_CACHE_KEY = 'cidirilkPodcastPlaylistArtwork';
const PODCAST_ARTWORK_CACHE_TTL = 24 * 60 * 60 * 1000;

const normalizeSoundCloudArtworkUrl = (url) => {
  const artworkUrl = String(url || '').trim();
  if (!artworkUrl) return '';
  return artworkUrl.replace(/-large(?=\.[a-z0-9]+(?:\?|$))/i, '-t500x500');
};

const getCachedPodcastArtwork = (playlistUrl) => {
  try {
    const cached = JSON.parse(localStorage.getItem(PODCAST_ARTWORK_CACHE_KEY) || 'null');
    if (
      cached?.playlistUrl === playlistUrl &&
      cached?.artworkUrl &&
      Date.now() - cached.cachedAt < PODCAST_ARTWORK_CACHE_TTL
    ) {
      return cached.artworkUrl;
    }
  } catch (e) {}
  return '';
};

const cachePodcastArtwork = (playlistUrl, artworkUrl) => {
  if (!playlistUrl || !artworkUrl) return;
  try {
    localStorage.setItem(
      PODCAST_ARTWORK_CACHE_KEY,
      JSON.stringify({ playlistUrl, artworkUrl, cachedAt: Date.now() })
    );
  } catch (e) {}
};

const fetchPodcastPlaylistArtwork = async (playlistUrl) => {
  const cachedArtwork = getCachedPodcastArtwork(playlistUrl);
  if (cachedArtwork) return cachedArtwork;

  try {
    const response = await fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(playlistUrl)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!response.ok) return '';
    const data = await response.json();
    const artworkUrl = normalizeSoundCloudArtworkUrl(data?.thumbnail_url);
    cachePodcastArtwork(playlistUrl, artworkUrl);
    return artworkUrl;
  } catch (e) {
    return '';
  }
};

const preparePodcastClone = (slide) => {
  const clone = slide.cloneNode(true);
  clone.inert = true;
  clone.classList.remove('active');
  clone.dataset.podcastClone = 'true';
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('.podcast-episode').forEach((card) => {
    card.classList.remove('active');
    card.dataset.podcastClone = 'true';
    card.removeAttribute('data-soundcloud-track');
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
    card.removeAttribute('aria-current');
  });
  clone.querySelectorAll('[data-soundcloud-card-frame]').forEach((frame) => {
    frame.removeAttribute('src');
  });
  clone.querySelectorAll('[data-soundcloud-card-player]').forEach((player) => {
    player.classList.remove('is-loading-preview', 'is-preview-ready');
    player.classList.add('is-unloaded');
  });
  return clone;
};

const addPodcastCarouselClones = (list) => {
  const slides = [...list.querySelectorAll('.podcast-slide')];
  if (slides.length < 2) return;
  list.prepend(preparePodcastClone(slides[slides.length - 1]));
  list.appendChild(preparePodcastClone(slides[0]));
};

const resolveVisibleSoundCloudEpisodes = async (tracks) => {
  const startIndex = Math.max(0, tracks.length - MEDIA_CAROUSEL_LIMIT);
  const visibleTracks = await Promise.all(
    tracks.slice(startIndex)
      .map((track, index) => resolveSoundCloudEpisode(track, startIndex + index))
      .reverse()
  );
  // Keep only what the cards need so the list caches compactly.
  return visibleTracks.map(({ id, permalink_url, title, trackIndex }) => ({ id, permalink_url, title, trackIndex }));
};

// Cached episode list renders instantly on repeat visits; it is revalidated in the background.
const PODCAST_TRACKS_CACHE_KEY = 'cidirilkPodcastTracks';
const PODCAST_TRACKS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const getPodcastTracksSignature = (tracks) =>
  tracks.map((track) => `${track.id}:${track.title || ''}`).join('|');

const getCachedPodcastTracks = (playlistUrl) => {
  try {
    const cached = JSON.parse(localStorage.getItem(PODCAST_TRACKS_CACHE_KEY) || 'null');
    if (
      cached?.playlistUrl === playlistUrl &&
      Array.isArray(cached?.tracks) &&
      cached.tracks.length &&
      Date.now() - cached.cachedAt < PODCAST_TRACKS_CACHE_TTL
    ) {
      return cached.tracks;
    }
  } catch (e) {}
  return null;
};

const cachePodcastTracks = (playlistUrl, tracks) => {
  if (!playlistUrl || !tracks?.length) return;
  try {
    localStorage.setItem(
      PODCAST_TRACKS_CACHE_KEY,
      JSON.stringify({ playlistUrl, tracks, cachedAt: Date.now() })
    );
  } catch (e) {}
};

const renderSoundCloudEpisodes = (visibleTracks, playlistArtworkUrl = '') => {
  if (!soundCloudEpisodeLists.length || !visibleTracks?.length) return;
  const selectedIndex = Number.parseInt(soundCloudSourcePlayers[0]?.dataset.soundcloudTrackIndex || '0', 10);
  const activeIndex = Math.min(Number.isNaN(selectedIndex) ? 0 : selectedIndex, visibleTracks.length - 1);
  const playlistUrl = String(soundCloudSourcePlayers[0]?.dataset.soundcloudUrl || '').trim();
  const playlistArtwork = normalizeSoundCloudArtworkUrl(playlistArtworkUrl);

  soundCloudEpisodeLists.forEach((list) => {
    list.replaceChildren();
    visibleTracks.forEach((track, index) => {
      const slide = document.createElement('div');
      slide.className = 'podcast-slide';
      const card = document.createElement('article');
      const active = index === activeIndex;
      card.className = `podcast-episode${active ? ' active' : ''}`;
      card.dataset.soundcloudTrack = String(index);
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `${formatPodcastEpisodeTitle()} ${formatPodcastEpisodeLabel(track)}`);
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-current', active ? 'true' : 'false');
      setCardDescendantFocusability(card, active);
      if (playlistArtwork) {
        card.classList.add('has-artwork');
        card.style.setProperty('--podcast-artwork', `url("${playlistArtwork}")`);
      }

      const trackUrl = getSoundCloudTrackUrl(track);
      const playerUrl = trackUrl || playlistUrl;
      const playerIndex = Number.isInteger(track?.trackIndex) ? track.trackIndex : index;
      const player = document.createElement('span');
      player.className = `podcast-episode-player${active ? ' is-loading-preview' : ' is-unloaded'}`;
      player.dataset.soundcloudCardPlayer = '';
      if (active) player.dataset.previewStartedAt = String(Date.now());
      if (playerUrl) {
        const iframe = document.createElement('iframe');
        iframe.className = 'podcast-card-frame';
        iframe.title = `${formatPodcastEpisodeLabel(track)} SoundCloud preview`;
        iframe.loading = 'eager';
        iframe.scrolling = 'no';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.dataset.soundcloudCardFrame = '';
        iframe.dataset.soundcloudSrc = buildSoundCloudPlayerSrc(playerUrl, playerIndex, !trackUrl);
        preparePodcastCardFrame(card, player, iframe);
        // setActiveSoundCloudTrack loads the frame after the card is attached.
        player.appendChild(iframe);
      }

      const meta = document.createElement('span');
      meta.className = 'podcast-episode-meta';
      const number = document.createElement('span');
      number.className = 'podcast-episode-number';
      number.textContent = formatPodcastEpisodeLabel(track);
      meta.appendChild(number);
      card.append(meta, player, createPodcastControls(track));
      slide.appendChild(card);
      list.appendChild(slide);
    });
    addPodcastCarouselClones(list);
  });
  renderPodcastCarouselDots(visibleTracks.length);
  setActiveSoundCloudTrack(activeIndex, { instant: true });
};

podcastCarouselPrev?.addEventListener('click', () => movePodcastCarousel(-1));
podcastCarouselNext?.addEventListener('click', () => movePodcastCarousel(1));

let soundCloudEpisodesStarted = false;

const initSoundCloudEpisodeLists = () => {
  if (soundCloudEpisodesStarted) return;
  if (!soundCloudSourcePlayers.length || !soundCloudEpisodeLists.length) return;
  // SoundCloud draws its waveform on a canvas; do not initialize in a hidden tab.
  if (![...soundCloudEpisodeLists].some((list) => list.clientWidth > 0)) return;
  soundCloudEpisodesStarted = true;
  const playlistUrl = String(soundCloudSourcePlayers[0]?.dataset.soundcloudUrl || '').trim();
  // Artwork does not depend on the track list, so fetch it alongside the widget boot.
  const artworkPromise = fetchPodcastPlaylistArtwork(playlistUrl);
  const cachedTracks = getCachedPodcastTracks(playlistUrl);

  if (cachedTracks) {
    artworkPromise.then((artworkUrl) => renderSoundCloudEpisodes(cachedTracks, artworkUrl));
    // Revalidate once the visible preview has had a head start on the network.
    setTimeout(() => fetchSoundCloudTrackList(playlistUrl, artworkPromise, cachedTracks), 3000);
    return;
  }

  renderSoundCloudEpisodeStatus('Getting signals from SoundCloud...', true);
  fetchSoundCloudTrackList(playlistUrl, artworkPromise, null);
};

const fetchSoundCloudTrackList = (playlistUrl, artworkPromise, cachedTracks) => {
  loadSoundCloudSourcePlayers();
  if (!window.SC?.Widget) {
    if (!cachedTracks) {
      renderSoundCloudEpisodeStatus('SoundCloud player could not load. Please refresh in a moment.');
    }
    return;
  }

  let rendered = false;
  const widget = window.SC.Widget(soundCloudSourcePlayers[0]);
  widget.bind(window.SC.Widget.Events.READY, () => {
    if (typeof widget.getSounds !== 'function') return;
    widget.getSounds(async (tracks) => {
      if (Array.isArray(tracks) && tracks.length) {
        rendered = true;
        const visibleTracks = await resolveVisibleSoundCloudEpisodes(tracks);
        releaseSoundCloudSourcePlayers();
        cachePodcastTracks(playlistUrl, visibleTracks);
        // Skip the re-render when the cached list was already current.
        if (cachedTracks && getPodcastTracksSignature(cachedTracks) === getPodcastTracksSignature(visibleTracks)) return;
        renderSoundCloudEpisodes(visibleTracks, await artworkPromise);
      }
    });
  });

  if (cachedTracks) return;
  setTimeout(() => {
    if (!rendered) renderSoundCloudEpisodeStatus('Still connecting to SoundCloud...');
  }, 4000);
};

window.addEventListener('cidirilk:tabchange', initSoundCloudEpisodeLists);
window.addEventListener('resize', initSoundCloudEpisodeLists, { passive: true });

const loadVisiblePodcastPreview = () => {
  soundCloudEpisodeLists.forEach((list) => {
    const card = list.querySelector('.podcast-episode.active');
    if (card) loadPodcastCardPlayer(card);
  });
};
window.addEventListener('cidirilk:tabchange', loadVisiblePodcastPreview);
window.addEventListener('resize', loadVisiblePodcastPreview, { passive: true });

const setTheme = (mode) => {
  root.setAttribute('data-theme', mode);
  try {
    localStorage.setItem('theme', mode);
  } catch (e) {}
  syncThemeIcon();
  // Turnstile can't restyle live, so re-render it to match the new theme.
  renderTurnstile();
  
  // Force repaint on mobile
  document.body.style.display = 'none';
  document.body.offsetHeight; // Trigger reflow
  document.body.style.display = '';
};

const initTheme = () => {
  let stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch (e) {}
  
  if (stored === 'light' || stored === 'dark') {
    root.setAttribute('data-theme', stored);
  } else {
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
const closeChat = () => {
  if (!chatPanel) return;
  const chatIframe = chatPanel.querySelector('iframe');
  if (chatIframe) chatIframe.src = 'about:blank';
  chatPanel.classList.remove('is-open');
  chatPanel.innerHTML = '';
  chatLoaded = false;
};

// Custom nickname prompt
const nicknameOverlay = document.querySelector('[data-nickname-overlay]');
const nicknameForm = document.querySelector('[data-nickname-form]');
const nicknameCancel = document.querySelector('[data-nickname-cancel]');
const nicknameCard = nicknameOverlay?.querySelector('.nickname-card');
const NICKNAME_COOKIE = 'cidirilkChatNickname';
let chatLoaded = false;
let nicknameLastFocus = null;
let nicknamePreviousBodyOverflow = '';

const getSavedNickname = () => getCookie(NICKNAME_COOKIE);

const saveNickname = (nickname) => {
  setCookie(NICKNAME_COOKIE, nickname, 365); // Save for 1 year
};

const showNicknamePrompt = () => {
  nicknameLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  nicknamePreviousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
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

const hideNicknamePrompt = ({ restoreFocus = true } = {}) => {
  if (nicknameOverlay?.hasAttribute('hidden')) return;
  nicknameOverlay?.setAttribute('hidden', '');
  document.body.style.overflow = nicknamePreviousBodyOverflow;
  const focusTarget = nicknameLastFocus?.isConnected
    ? nicknameLastFocus
    : chatToggles[0];
  if (restoreFocus && focusTarget instanceof HTMLElement) {
    try {
      focusTarget.focus({ preventScroll: true });
    } catch (e) {
      focusTarget.focus();
    }
  }
  nicknameLastFocus = null;
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
      <div class="chat-header-actions">
        <button class="icon-button chat-nickname-change" type="button" aria-label="Change chat nickname" title="Change nickname" data-chat-change-nickname>
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
        <button class="icon-button chat-close" type="button" aria-label="Leave chat" title="Leave chat" data-chat-close>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </header>
    <iframe
      title="hack.chat cidirilk room"
      src="https://hack.chat/?cidirilk#${encodeURIComponent(nickname)}"
      loading="lazy"
      referrerpolicy="no-referrer"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
    ></iframe>
    <p class="chat-helper">Nickname taken? It may already be active in another tab. Use the close button to leave this session or choose another nickname.</p>
    <p class="chat-helper">Hosted on hack.chat - no login required. If the embed fails, open the room directly.</p>
    <a class="btn ghost compact" href="https://hack.chat/?cidirilk" target="_blank" rel="noopener">Open hack.chat</a>
  `;
  
  // Re-attach controls because this panel is rendered dynamically.
  const changeNicknameBtn = chatPanel.querySelector('[data-chat-change-nickname]');
  const newCloseBtn = chatPanel.querySelector('[data-chat-close]');
  changeNicknameBtn?.addEventListener('click', () => {
    closeChat();
    showNicknamePrompt();
  });
  newCloseBtn?.addEventListener('click', closeChat);
  
  openChat();
  hideNicknamePrompt({ restoreFocus: false });
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

nicknameOverlay?.addEventListener('keydown', (event) => {
  if (nicknameOverlay.hasAttribute('hidden')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    hideNicknamePrompt();
    return;
  }
  if (event.key !== 'Tab' || !nicknameCard) return;
  trapFocus(event, nicknameCard);
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
  desktopRadioToggle.setAttribute('aria-pressed', 'true');
  setDesktopRadioToggleLabel();
};

const collapseDesktopRadioPopup = () => {
  if (!desktopRadioPopup || !desktopRadioToggle) return;
  if (desktopRadioPopup.classList.contains('is-collapsed')) return;
  if (desktopRadioCollapseTimer) clearTimeout(desktopRadioCollapseTimer);
  desktopRadioPopup.classList.add('is-collapsing');
  desktopRadioPopup.classList.add('is-collapsed');
  desktopRadioToggle.setAttribute('aria-expanded', 'false');
  desktopRadioToggle.setAttribute('aria-pressed', 'false');
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
  mobileRadioToggle.setAttribute('aria-pressed', 'true');
  setMobileRadioToggleLabel();
};

const closeMobileRadioPopover = () => {
  if (!mobileRadioToggle || !mobileRadioPopover) return;
  if (mobileRadioPopover.hasAttribute('hidden')) {
    mobileRadioPopover.classList.remove('is-open', 'is-closing');
    mobileRadioToggle.setAttribute('aria-expanded', 'false');
    mobileRadioToggle.setAttribute('aria-pressed', 'false');
    setMobileRadioToggleLabel();
    return;
  }
  if (mobileRadioCloseTimer) clearTimeout(mobileRadioCloseTimer);
  mobileRadioPopover.classList.remove('is-open');
  mobileRadioPopover.classList.add('is-closing');
  mobileRadioToggle.setAttribute('aria-expanded', 'false');
  mobileRadioToggle.setAttribute('aria-pressed', 'false');
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

// Live radio inside the page: "Listen Live" plays the LiveSets stream through
// the proxy worker's /live/audio (it redirects to the current, tokenised
// stream URL). If that cannot start (worker not updated yet, stream down),
// the button falls back to opening the LiveSets live page like before.
const liveRadio = {
  audio: null,
  playing: false,
  starting: false,
  failed: false,
  timer: 0,
};

function getLiveRadioAudio() {
  if (liveRadio.audio) return liveRadio.audio;
  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.hidden = true;
  audio.dataset.liveRadioAudio = '';
  audio.addEventListener('playing', () => {
    clearTimeout(liveRadio.timer);
    liveRadio.starting = false;
    liveRadio.playing = true;
    liveRadio.failed = false;
    renderLiveRadioState();
  });
  audio.addEventListener('pause', () => {
    liveRadio.playing = false;
    liveRadio.starting = false;
    renderLiveRadioState();
  });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    liveRadio.playing = false;
    liveRadio.starting = false;
    liveRadio.failed = true;
    renderLiveRadioState();
  });
  document.body.appendChild(audio);
  liveRadio.audio = audio;
  return audio;
}

function renderLiveRadioState() {
  const { playing, starting, failed } = liveRadio;
  document.querySelectorAll('[data-live-radio-btn]').forEach((btn) => {
    btn.classList.toggle('is-radio-playing', playing);
    btn.classList.toggle('is-radio-starting', starting);
    const label = btn.querySelector('[data-live-radio-text]');
    const icon = btn.querySelector('.live-listen-icon');
    const text = failed ? 'Open LiveSets' : starting ? 'Tuning in…' : playing ? 'Pause live' : 'Listen Live';
    if (label) label.textContent = text;
    if (icon) icon.className = `fa-solid ${playing ? 'fa-pause' : failed ? 'fa-arrow-up-right-from-square' : 'fa-headphones'} live-listen-icon`;
    btn.setAttribute('aria-label', failed
      ? 'Open the live radio on LiveSets (opens in a new tab)'
      : playing ? 'Pause the live radio' : 'Listen to the live radio here');
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  });
  document.querySelectorAll('[data-live-banner], [data-live-mobile-toggle], [data-desktop-radio-toggle]').forEach((el) => {
    el.classList.toggle('is-radio-playing', playing);
  });
  document.querySelectorAll('[data-live-radio-note]').forEach((note) => {
    note.hidden = !failed && !playing;
    note.textContent = failed
      ? 'Couldn’t start the stream here. Open it on LiveSets instead.'
      : 'Playing live on this page.';
  });
}

function stopLiveRadio() {
  const audio = liveRadio.audio;
  if (!audio) return;
  audio.pause();
  // A live stream cannot resume where it paused: drop it, reconnect on play
  audio.removeAttribute('src');
  audio.load();
  liveRadio.playing = false;
  liveRadio.starting = false;
  renderLiveRadioState();
}

function startLiveRadio() {
  const proxyBase = LIVESETS_PROXY_WORKER
    ? (LIVESETS_PROXY_WORKER.endsWith('/') ? LIVESETS_PROXY_WORKER : `${LIVESETS_PROXY_WORKER}/`)
    : '';
  if (!proxyBase) return false;
  const audio = getLiveRadioAudio();
  liveRadio.starting = true;
  liveRadio.failed = false;
  renderLiveRadioState();
  audio.src = `${proxyBase}live/audio?t=${Date.now()}`;
  // Some networks (VPNs, company proxies) hold live streams back forever:
  // after 15s without sound, fall back to opening LiveSets
  clearTimeout(liveRadio.timer);
  liveRadio.timer = setTimeout(() => {
    if (!liveRadio.starting) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    liveRadio.starting = false;
    liveRadio.failed = true;
    renderLiveRadioState();
  }, 15000);
  // play() runs inside the tap/click so phones allow it
  audio.play().catch((error) => {
    if (error?.name === 'AbortError') return;
    liveRadio.starting = false;
    liveRadio.failed = true;
    renderLiveRadioState();
  });
  return true;
}

document.querySelectorAll('[data-live-radio-btn]').forEach((btn) => {
  // Note under the buttons: "Playing live on this page." / fallback hint
  const actions = btn.closest('.live-popup-actions');
  if (actions && !actions.parentElement.querySelector('[data-live-radio-note]')) {
    const note = document.createElement('p');
    note.className = 'live-popup-note';
    note.dataset.liveRadioNote = '';
    note.setAttribute('role', 'status');
    note.hidden = true;
    actions.after(note);
  }
  btn.addEventListener('click', (event) => {
    // After a failure the button is a plain link to LiveSets again
    if (liveRadio.failed) return;
    event.preventDefault();
    if (liveRadio.playing || liveRadio.starting) {
      stopLiveRadio();
      return;
    }
    if (!startLiveRadio()) window.open(btn.href, '_blank', 'noopener');
  });
});

const updateLiveIndicator = (isLive) => {
  const state = Boolean(isLive);
  // The broadcast ended: stop the in-page radio and reset the button
  if (!state && liveRadio.audio) {
    stopLiveRadio();
    liveRadio.failed = false;
  }
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
  });
  renderLiveRadioState();
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

const LIVESETS_SESSIONS_CACHE_KEY = 'cidirilkLiveSetsSessions';
const LIVESETS_SESSIONS_CACHE_TTL = 30 * 60 * 1000;
const LIVESETS_FALLBACK_ARTWORK =
  'https://livesets.com/cache/images/resize/300/dab2d6bc379caf377c44d13ce6252562.png';
const LIVESETS_FALLBACK_SESSIONS = [
  {
    index: 1,
    title: 'mood_rec( *six.6)',
    url: 'https://livesets.com/cidirilk/session/72255',
    age: '2 days ago',
    genre: 'Techno',
    duration: '58:20',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 2,
    title: 'mood_rec( *six.5)',
    url: 'https://livesets.com/cidirilk/session/71461',
    age: '4 days ago',
    genre: 'Techno',
    duration: '59:55',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 3,
    title: 'mood_rec( *six.4)',
    url: 'https://livesets.com/cidirilk/session/71442',
    age: '3 months ago',
    genre: 'Techno',
    duration: '1:00:07',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 4,
    title: 'mood_rec( *six.3)',
    url: 'https://livesets.com/cidirilk/session/71430',
    age: '3 months ago',
    genre: 'Techno',
    duration: '1:00:16',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 5,
    title: 'mood_rec( *six.2)',
    url: 'https://livesets.com/cidirilk/session/71426',
    age: '3 months ago',
    genre: 'Techno',
    duration: '59:45',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 6,
    title: 'mood_rec( *six.1)',
    url: 'https://livesets.com/cidirilk/session/71424',
    age: '3 months ago',
    genre: 'Techno',
    duration: '1:01:47',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 7,
    title: 'mood_rec( *six.0)',
    url: 'https://livesets.com/cidirilk/session/71412',
    age: '3 months ago',
    genre: 'Techno',
    duration: '2:00:04',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 8,
    title: 'mood_rec( *five.9)',
    url: 'https://livesets.com/cidirilk/session/71307',
    age: '3 months ago',
    genre: 'Techno',
    duration: '44:42',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 9,
    title: 'mood_rec( *five.8)',
    url: 'https://livesets.com/cidirilk/session/70834',
    age: '3 months ago',
    genre: 'Techno',
    duration: '1:46:04',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
  {
    index: 10,
    title: 'mood_rec( *five.7)',
    url: 'https://livesets.com/cidirilk/session/70539',
    age: '6 months ago',
    genre: 'Techno',
    duration: '1:00:18',
    artwork: LIVESETS_FALLBACK_ARTWORK,
  },
];
const liveSetsSessionMetaCache = new Map();

const normalizeLiveSetsUrl = (url) => {
  const value = String(url || '').trim();
  if (!value) return '';
  return value.startsWith('http') ? value : `https://livesets.com${value}`;
};

const getLiveSetsProxyBase = () => {
  if (!LIVESETS_PROXY_WORKER) return '';
  return LIVESETS_PROXY_WORKER.endsWith('/')
    ? LIVESETS_PROXY_WORKER
    : `${LIVESETS_PROXY_WORKER}/`;
};

const getLiveSetsSessionId = (session) => {
  const id = String(session?.id || '').trim();
  if (id) return id;
  const url = String(session?.url || '').trim();
  return url.match(/\/session\/(\d+)/)?.[1] || '';
};

const normalizeLiveSetsSessionMeta = (meta) => ({
  id: String(meta?.id || meta?.soundId || ''),
  title: String(meta?.title || ''),
  duration: Number(meta?.duration || 0),
  urlAudio: Array.isArray(meta?.urlAudio)
    ? meta.urlAudio
        .map((audio) => ({
          type: String(audio?.type || ''),
          url: normalizeLiveSetsUrl(audio?.url || ''),
        }))
        .filter((audio) => audio.url)
    : [],
});

const readCachedLiveSetsSessions = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(LIVESETS_SESSIONS_CACHE_KEY) || 'null');
    if (
      Array.isArray(cached?.sessions) &&
      cached.sessions.length &&
      Date.now() - cached.cachedAt < LIVESETS_SESSIONS_CACHE_TTL
    ) {
      return cached.sessions;
    }
  } catch (error) {}
  return [];
};

const cacheLiveSetsSessions = (sessions) => {
  if (!Array.isArray(sessions) || !sessions.length) return;
  try {
    localStorage.setItem(
      LIVESETS_SESSIONS_CACHE_KEY,
      JSON.stringify({ sessions, cachedAt: Date.now() })
    );
  } catch (error) {}
};

const parseLiveSetsSessionsHtml = (html) => {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return [...doc.querySelectorAll('.media-list.item')]
    .map((item, index) => {
      const titleLink = item.querySelector('.head a');
      const avatarStyle = item.querySelector('.avatar')?.getAttribute('style') || '';
      const artworkMatch = avatarStyle.match(/url\(['"]?([^'")]+)['"]?\)/i);
      const subText = item.querySelector('.sub')?.textContent.replace(/\s+/g, ' ').trim() || '';
      const [, age = ''] = subText.split('|').map((part) => part.trim());

      return {
        index: index + 1,
        title: titleLink?.textContent.replace(/\s+/g, ' ').trim() || '',
        url: normalizeLiveSetsUrl(item.dataset.url || titleLink?.getAttribute('href')),
        age,
        genre: item.querySelector('.info .meta')?.textContent.replace(/\s+/g, ' ').trim() || '',
        duration: item.querySelector('.playtime')?.textContent.replace(/\s+/g, ' ').trim() || '',
        artwork: normalizeLiveSetsUrl(artworkMatch?.[1] || ''),
      };
    })
    .filter((session) => session.title && session.url);
};

const buildLiveSetsSessionStrategies = () => {
  const encoded = encodeURIComponent(LIVESETS_SESSIONS_URL);
  const strategies = [];
  const base = getLiveSetsProxyBase();

  if (base) {
    strategies.push({
      name: 'worker',
      url: `${base}sessions?t=${Date.now()}`,
      extract: async (response) => {
        const payload = await response.json();
        return Array.isArray(payload?.sessions) ? payload.sessions : [];
      },
    });
  }

  strategies.push(
    {
      name: 'allorigins',
      url: `https://api.allorigins.win/get?url=${encoded}`,
      extract: async (response) => {
        const payload = await response.json();
        return parseLiveSetsSessionsHtml(payload?.contents || '');
      },
    },
    {
      name: 'codetabs',
      url: `https://api.codetabs.com/v1/proxy/?quest=${encoded}`,
      extract: async (response) => parseLiveSetsSessionsHtml(await response.text()),
    },
  );

  return strategies;
};

const fetchLiveSetsSessions = async () => {
  for (const strategy of buildLiveSetsSessionStrategies()) {
    try {
      const response = await fetch(strategy.url, {
        headers: { Accept: strategy.name === 'worker' ? 'application/json' : 'text/html, application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`${strategy.name} status ${response.status}`);
      const sessions = await strategy.extract(response);
      if (Array.isArray(sessions) && sessions.length) return sessions;
    } catch (error) {
      continue;
    }
  }
  return [];
};

const buildLiveSetsSessionMetaStrategies = (sessionId) => {
  const target = `https://livesets.com/json/session/meta/${sessionId}`;
  const encoded = encodeURIComponent(target);
  const strategies = [];
  const base = getLiveSetsProxyBase();

  if (base) {
    strategies.push({
      name: 'worker',
      url: `${base}session-meta/${sessionId}?t=${Date.now()}`,
      extract: async (response) => {
        const payload = await response.json();
        return normalizeLiveSetsSessionMeta(payload?.meta);
      },
    });
  }

  strategies.push(
    {
      name: 'allorigins',
      url: `https://api.allorigins.win/get?url=${encoded}`,
      extract: async (response) => {
        const payload = await response.json();
        return normalizeLiveSetsSessionMeta(JSON.parse(payload?.contents || '{}'));
      },
    },
    {
      name: 'codetabs',
      url: `https://api.codetabs.com/v1/proxy/?quest=${encoded}`,
      extract: async (response) => normalizeLiveSetsSessionMeta(JSON.parse(await response.text())),
    },
  );

  return strategies;
};

const fetchLiveSetsSessionMeta = async (sessionId, signal) => {
  if (!sessionId) return null;
  if (liveSetsSessionMetaCache.has(sessionId)) return liveSetsSessionMetaCache.get(sessionId);

  for (const strategy of buildLiveSetsSessionMetaStrategies(sessionId)) {
    try {
      const response = await fetch(strategy.url, {
        headers: { Accept: strategy.name === 'worker' ? 'application/json' : 'text/html, application/json' },
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error(`${strategy.name} status ${response.status}`);
      const meta = await strategy.extract(response);
      if (meta?.urlAudio?.length) {
        liveSetsSessionMetaCache.set(sessionId, meta);
        return meta;
      }
    } catch (error) {
      if (signal?.aborted) return null;
      continue;
    }
  }

  return null;
};

const renderLiveSetsSessionsStatus = (message, isLoading = false) => {
  liveSetsCarouselDots?.replaceChildren();
  liveSetsSessionLists.forEach((list) => {
    list.style.transform = '';
    list.replaceChildren();
    const status = document.createElement('span');
    status.className = 'sessions-status';
    if (isLoading) {
      const spinner = document.createElement('span');
      spinner.className = 'podcast-loading-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      status.appendChild(spinner);
    }
    const text = document.createElement('span');
    text.textContent = message;
    status.appendChild(text);
    list.appendChild(status);
  });
};

let liveSetsSessionCount = 0;
let youtubeVideoCount = 0;
let renderedLiveSetsSignature = '';
let pendingLiveSetsSessions = null;

const getLiveSetsSessionsSignature = (sessions) => sessions
  .slice(0, MEDIA_CAROUSEL_LIMIT)
  .map((session) => [
    getLiveSetsSessionId(session),
    String(session?.title || ''),
    String(session?.url || ''),
    String(session?.duration || ''),
    String(session?.genre || ''),
    String(session?.artwork || ''),
  ].join('\u001f'))
  .join('\u001e');

const hasPlayingLiveSetsSession = () => getLiveSetsSessionCards().some((card) =>
  card.classList.contains('is-playing-session') || !card.querySelector('[data-livesets-audio]')?.paused,
);

const YOUTUBE_VIDEOS = [
  {
    id: 'GxuFIf0Nyqg',
    title: 'cidirilk_aLive',
  },
  {
    id: 'DnCT4AkjR0g',
    title: 'cidirilk_keepIt_real',
  },
  {
    id: 'JaXO00J4rO0',
    title: 'cidirilk_im_Not_leaving',
  },
  {
    id: '4V5Hhjnk23o',
    title: 'cidirilk_setup_before_iGo',
  },
].map((video) => ({
  ...video,
  url: `https://youtu.be/${video.id}`,
  embedUrl: `https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
  autoplayUrl: `https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&autoplay=1`,
  thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
}));

const getLiveSetsSessionCards = () =>
  [...document.querySelectorAll('.sessions-card[data-livesets-session]')];

const getYoutubeCards = () =>
  [...document.querySelectorAll('.youtube-card[data-youtube-video]')];

const getActiveLiveSetsSessionIndex = () => {
  const current = getLiveSetsSessionCards().find(
    (card) => card.getAttribute('aria-current') === 'true'
  );
  const sessionIndex = Number.parseInt(current?.dataset.livesetsSession || '0', 10);
  return Number.isNaN(sessionIndex) ? 0 : sessionIndex;
};

const renderLiveSetsCarouselDots = (count, activeIndex = getActiveLiveSetsSessionIndex()) => {
  if (!liveSetsCarouselDots) return;
  liveSetsSessionCount = count;
  const visibleCount = Math.min(count, LIVESETS_DOT_WINDOW);
  const startIndex = Math.max(0, Math.min(activeIndex - Math.floor(visibleCount / 2), count - visibleCount));

  liveSetsCarouselDots.replaceChildren();
  Array.from({ length: visibleCount }).forEach((_, dotIndex) => {
    const index = startIndex + dotIndex;
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.type = 'button';
    dot.classList.toggle('active', index === activeIndex);
    dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    dot.setAttribute('aria-label', `Go to LiveSets session ${index + 1}`);
    dot.addEventListener('click', () => setActiveLiveSetsSession(index));
    liveSetsCarouselDots.appendChild(dot);
  });
};

const getActiveYoutubeVideoIndex = () => {
  const current = getYoutubeCards().find((card) => card.getAttribute('aria-current') === 'true');
  const videoIndex = Number.parseInt(current?.dataset.youtubeVideo || '0', 10);
  return Number.isNaN(videoIndex) ? 0 : videoIndex;
};

const renderYoutubeCarouselDots = (count, activeIndex = getActiveYoutubeVideoIndex()) => {
  if (!youtubeCarouselDots) return;
  youtubeVideoCount = count;
  const visibleCount = Math.min(count, YOUTUBE_DOT_WINDOW);
  const startIndex = Math.max(0, Math.min(activeIndex - Math.floor(visibleCount / 2), count - visibleCount));

  youtubeCarouselDots.replaceChildren();
  Array.from({ length: visibleCount }).forEach((_, dotIndex) => {
    const index = startIndex + dotIndex;
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.type = 'button';
    dot.classList.toggle('active', index === activeIndex);
    dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    dot.setAttribute('aria-label', `Go to YouTube video ${index + 1}`);
    dot.addEventListener('click', () => setActiveYoutubeVideo(index));
    youtubeCarouselDots.appendChild(dot);
  });
};

const loadYoutubeCardPlayer = (card, autoplay = false) => {
  const frame = card?.querySelector('[data-youtube-frame]');
  const player = card?.querySelector('[data-youtube-player]');
  if (!frame || frame.getAttribute('src')) return;
  const src = autoplay ? frame.dataset.youtubeAutoplaySrc : frame.dataset.youtubeSrc;
  if (!src) return;
  const embedUrl = new URL(src);
  if (window.location.origin !== 'null') embedUrl.searchParams.set('origin', window.location.origin);
  frame.src = embedUrl.toString();
  player?.classList.add('is-loaded');
  bindYoutubeApi(card, frame);
};

const unloadYoutubeCardPlayer = (card) => {
  const frame = card?.querySelector('[data-youtube-frame]');
  const player = card?.querySelector('[data-youtube-player]');
  if (!frame) return;
  frame.removeAttribute('src');
  player?.classList.remove('is-loaded');
  card._ytPlayer = null;
  card.classList.remove('is-yt-playing', 'has-yt-error');
};

// YouTube IFrame API on top of our embeds: our own play/pause button (YouTube's
// tiny mobile controls are easy to miss), a clear message when a video is
// blocked from playing on this device/site, and one player at a time.
let youtubeApiPromise = null;
const loadYoutubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return youtubeApiPromise;
};

const setYoutubeToggle = (card, playing) => {
  card.classList.toggle('is-yt-playing', playing);
  const toggle = card.querySelector('[data-youtube-toggle]');
  if (!toggle) return;
  toggle.querySelector('span').textContent = playing ? 'Pause' : 'Play';
  toggle.querySelector('i').className = `fa-solid ${playing ? 'fa-pause' : 'fa-play'}`;
  toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${toggle.dataset.title || 'video'}`);
};

const pauseYoutubePlayers = (except) => {
  getYoutubeCards().forEach((card) => {
    if (card !== except) card._ytPlayer?.pauseVideo?.();
  });
};

function bindYoutubeApi(card, frame) {
  setYoutubeToggle(card, false);
  loadYoutubeApi().then((YT) => {
    if (!frame.getAttribute('src') || card._ytPlayer) return;
    card._ytPlayer = new YT.Player(frame, {
      events: {
        onStateChange: (event) => {
          const playing = event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING;
          setYoutubeToggle(card, playing);
          if (event.data === YT.PlayerState.PLAYING) {
            pauseYoutubePlayers(card);
            document.querySelectorAll('audio').forEach((audio) => { if (!audio.paused) audio.pause(); });
            document.querySelectorAll('.podcast-episode').forEach((episode) => episode._podcastWidget?.pause());
          }
        },
        // 2 bad id, 5 HTML5 error, 100 removed/private, 101/150 owner blocks
        // playback on other sites (often music rights, per device or country)
        onError: () => {
          card.classList.add('has-yt-error');
          setYoutubeToggle(card, false);
        },
      },
    });
  });
}

const setActiveYoutubeVideo = (videoIndex, options = {}) => {
  renderYoutubeCarouselDots(youtubeVideoCount, videoIndex);
  youtubeVideoLists.forEach((list) => {
    list.querySelectorAll('.youtube-card[data-youtube-video]').forEach((card) => {
      const active = Number.parseInt(card.dataset.youtubeVideo || '0', 10) === videoIndex;
      card.classList.toggle('active', active);
      card.setAttribute('aria-current', active ? 'true' : 'false');
      // Desktop rows are focusable too (Enter/Space features and plays them)
      card.tabIndex = active || consoleListQuery.matches ? 0 : -1;
      if (active) {
        setPeekCarouselPosition(list, card.closest('.youtube-slide'), Boolean(options.instant), options.wrapDirection);
      } else {
        unloadYoutubeCardPlayer(card);
      }
    });
  });
};

const playYoutubeCard = (card) => {
  if (!card || !card.classList.contains('active')) return;
  loadYoutubeCardPlayer(card, true);
};

const setActiveLiveSetsSession = (sessionIndex, options = {}) => {
  renderLiveSetsCarouselDots(liveSetsSessionCount, sessionIndex);
  liveSetsSessionLists.forEach((list) => {
    list.querySelectorAll('.sessions-card[data-livesets-session]').forEach((card) => {
      const active = Number.parseInt(card.dataset.livesetsSession || '0', 10) === sessionIndex;
      card.classList.toggle('active', active);
      card.setAttribute('aria-current', active ? 'true' : 'false');
      card.tabIndex = active || consoleListQuery.matches ? 0 : -1;
      if (!active) {
        releaseLiveSetsCardPlayer(card);
        return;
      }
      loadLiveSetsRealWave(card);

      setPeekCarouselPosition(list, card.closest('.sessions-slide'), Boolean(options.instant), options.wrapDirection);
    });
  });
};

// LiveSets session cards: playing state, progress and the static waveform
// used by the desktop console list (featured card + selected row). Each set
// gets its own decorative shape (seeded by session id); the violet fill is
// the real playback position and clicking the waveform seeks.
const LIVESETS_WAVE_BARS = 60;

function setLiveSetsCardPlaying(card, title, playing) {
  card.classList.toggle('is-playing-session', playing);
  card.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${title} from LiveSets`);
}

// A seek past the loaded part restarts the stream at an offset (?t=), so
// positions are tracked as offset + currentTime over the whole set length.
function getLiveSetsOffset(card) {
  return Number(card.dataset.audioOffset || 0);
}

function getLiveSetsTotal(card, audio) {
  return Number(card.dataset.totalDuration || 0) || (audio.duration ? audio.duration + getLiveSetsOffset(card) : 0);
}

// 40:31 or 1:02:05 (hours only when the set is an hour or longer)
function formatLiveSetsTime(seconds, withHours) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return withHours ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${h * 60 + m}:${sec}`;
}

// The duration becomes "elapsed / total" once a set starts (desktop and phones)
function updateLiveSetsCardTime(card, position, total) {
  const label = card.querySelector('.sessions-card-duration');
  if (!label) return;
  const totalLabel = card.dataset.durationLabel || formatLiveSetsTime(total, total >= 3600);
  const text = position > 0
    ? `${formatLiveSetsTime(position, total >= 3600)} / ${totalLabel}`
    : totalLabel;
  if (label.textContent !== text) label.textContent = text;
}

function updateLiveSetsCardProgress(card, audio) {
  const total = getLiveSetsTotal(card, audio);
  if (!total) return;
  const position = getLiveSetsOffset(card) + audio.currentTime;
  updateLiveSetsCardTime(card, position, total);
  const ratio = Math.min(1, position / total);
  card.style.setProperty('--sessions-progress', `${(ratio * 100).toFixed(2)}%`);
  const played = Math.round(ratio * LIVESETS_WAVE_BARS);
  if (card.dataset.wavePlayed === String(played)) return;
  card.dataset.wavePlayed = String(played);
  card.querySelectorAll('.sessions-card-wave span').forEach((bar, index) => {
    bar.classList.toggle('is-played', index < played);
  });
}

function createLiveSetsWave(seed = 0) {
  const wave = document.createElement('span');
  wave.className = 'sessions-card-wave';
  wave.setAttribute('aria-hidden', 'true');
  const phase = (Number(seed) % 97) / 13;
  for (let i = 0; i < LIVESETS_WAVE_BARS; i += 1) {
    const bar = document.createElement('span');
    const shape = Math.abs(Math.sin(i * 0.9 + phase) * Math.cos(i * 0.31 + phase / 2));
    bar.style.height = `${18 + Math.round(shape * 82)}%`;
    wave.appendChild(bar);
  }
  return wave;
}

// LiveSets serves its MP3s without working byte ranges and Cloudflare does
// not pass Range through to the worker, so a jump past what is downloaded
// cannot use currentTime: it restarts the stream at that time via the
// worker's ?t= parameter. Without the worker, seeks stay in the loaded part.
function getLiveSetsLoadedEnd(audio) {
  const { buffered, currentTime } = audio;
  for (let i = 0; i < buffered.length; i += 1) {
    if (buffered.start(i) <= currentTime + 0.5 && currentTime <= buffered.end(i) + 0.5) {
      return buffered.end(i);
    }
  }
  return currentTime;
}

function updateLiveSetsCardLoaded(card, audio) {
  const total = getLiveSetsTotal(card, audio);
  if (!total) return;
  const offset = getLiveSetsOffset(card);
  const from = Math.floor((offset / total) * LIVESETS_WAVE_BARS);
  const loaded = Math.round(((offset + getLiveSetsLoadedEnd(audio)) / total) * LIVESETS_WAVE_BARS);
  if (card.dataset.waveLoaded === `${from}-${loaded}`) return;
  card.dataset.waveLoaded = `${from}-${loaded}`;
  card.querySelectorAll('.sessions-card-wave span').forEach((bar, index) => {
    bar.classList.toggle('is-loaded', index >= from && index < loaded);
  });
}

function showLiveSetsCardNotice(card, message) {
  const player = card.querySelector('[data-livesets-player]');
  const status = card.querySelector('[data-livesets-player-status]');
  if (!player || !status) return;
  status.textContent = message;
  player.classList.add('has-notice');
  clearTimeout(Number(card.dataset.noticeTimer));
  card.dataset.noticeTimer = String(setTimeout(() => {
    player.classList.remove('has-notice');
    if (!player.classList.contains('has-error') && !player.classList.contains('is-loading')) status.textContent = '';
  }, 4000));
}

// Desktop console list: any card toggles play/pause; clicking the waveform
// of the selected set skips within the loaded part.
async function toggleConsoleLiveSetsSession(card, event) {
  const audio = card.querySelector('[data-livesets-audio]');
  const wave = event?.target?.closest?.('.sessions-card-wave');
  if (wave && audio?.duration && card.classList.contains('active')) {
    const rect = wave.getBoundingClientRect();
    const total = getLiveSetsTotal(card, audio);
    const target = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * total;
    const relative = target - getLiveSetsOffset(card);
    const loadedEnd = getLiveSetsLoadedEnd(audio);
    const proxyBase = getLiveSetsProxyBase();
    const viaProxy = Boolean(proxyBase) && audio.currentSrc.startsWith(proxyBase);
    if (relative >= 0 && relative <= loadedEnd - 1) {
      audio.currentTime = relative; // already downloaded: instant
      updateLiveSetsCardProgress(card, audio);
      return;
    } else if (viaProxy) {
      seekLiveSetsByUrl(card, audio, target, proxyBase);
      return;
    } else {
      // Direct LiveSets file (worker unavailable): stay inside the loaded part
      audio.currentTime = Math.max(0, Math.min(Math.max(audio.currentTime, loadedEnd - 2), relative));
      showLiveSetsCardNotice(card, 'Skipped to the loaded part. LiveSets loads sets from the start, so the rest unlocks as it plays.');
      updateLiveSetsCardProgress(card, audio);
      return;
    }
  }
  if (card.classList.contains('is-playing-session')) {
    pauseLiveSetsCardPlayer(card);
    return;
  }
  if (!card.classList.contains('active')) {
    setActiveLiveSetsSession(Number.parseInt(card.dataset.livesetsSession || '0', 10), { instant: true });
    // The selected set becomes the featured player at the top of the list
    card.closest('.tab-panel')?.scrollTo({ top: 0, behavior: 'smooth' });
  }
  await playLiveSetsCard(card);
}

// Restart the stream at `seconds` through the worker (?t=). Preserve a user's
// paused state: seeking must not unexpectedly start audio.
function seekLiveSetsByUrl(card, audio, seconds, proxyBase, attempt = 1) {
  const start = Math.max(0, Math.floor(seconds));
  const sessionId = card.dataset.livesetsSessionId || '';
  const shouldResume = !audio.paused;
  const requestVersion = invalidateLiveSetsCardRequest(card);
  card.dataset.audioOffset = String(start);
  card.classList.add('is-buffering');
  const query = new URLSearchParams();
  if (start) query.set('t', String(start));
  if (attempt > 1) query.set('retry', String(attempt));
  audio.src = `${proxyBase}audio/${encodeURIComponent(sessionId)}${query.size ? `?${query}` : ''}`;
  audio.load();
  updateLiveSetsCardProgress(card, audio);
  updateLiveSetsCardLoaded(card, audio);

  if (!shouldResume) {
    audio.addEventListener('loadedmetadata', () => {
      if (!isCurrentLiveSetsCardRequest(card, requestVersion)) return;
      card.classList.remove('is-buffering');
      setLiveSetsCardPlayerState(card, 'is-ready');
    }, { once: true });
    return;
  }

  // Clear any earlier error as soon as audio flows again.
  audio.addEventListener('playing', () => {
    if (isCurrentLiveSetsCardRequest(card, requestVersion)) {
      setLiveSetsCardPlayerState(card, 'is-ready');
    }
  }, { once: true });
  audio.play().catch((error) => {
    if (error.name === 'AbortError') return;
    // One automatic retry covers a stream the worker cut off early
    if (attempt < 2 && isCurrentLiveSetsCardRequest(card, requestVersion) && card.classList.contains('active')) {
      setTimeout(() => seekLiveSetsByUrl(card, audio, seconds, proxyBase, attempt + 1), 600);
      return;
    }
    if (!isCurrentLiveSetsCardRequest(card, requestVersion)) return;
    card.classList.remove('is-buffering');
    setLiveSetsCardPlayerState(card, 'has-error', "Couldn't skip there right now. Try again.");
  });
}

// Real waveform (LiveSets publishes one per set) via the proxy worker's
// /waveform route; the decorative shape stays if it is unavailable.
async function loadLiveSetsRealWave(card) {
  const proxyBase = getLiveSetsProxyBase();
  const sessionId = card?.dataset.livesetsSessionId;
  if (!proxyBase || !sessionId || card.dataset.realWave) return;
  const controller = new AbortController();
  card._liveSetsWaveController?.abort();
  card._liveSetsWaveController = controller;
  card.dataset.realWave = 'loading';
  try {
    const response = await fetch(`${proxyBase}waveform/${encodeURIComponent(sessionId)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const data = response.ok ? await response.json() : null;
    if (controller.signal.aborted || card._liveSetsWaveController !== controller) return;
    const peaks = Array.isArray(data?.peaks) ? data.peaks.map(Number).filter(Number.isFinite) : [];
    if (peaks.length < LIVESETS_WAVE_BARS) throw new Error('no waveform');
    const bucket = peaks.length / LIVESETS_WAVE_BARS;
    const bars = Array.from({ length: LIVESETS_WAVE_BARS }, (_, i) =>
      Math.max(...peaks.slice(Math.floor(i * bucket), Math.max(Math.floor(i * bucket) + 1, Math.floor((i + 1) * bucket)))),
    );
    const top = Math.max(...bars) || 1;
    card.querySelectorAll('.sessions-card-wave span').forEach((bar, i) => {
      bar.style.height = `${Math.round(12 + (bars[i] / top) * 88)}%`;
    });
    card.dataset.realWave = 'true';
  } catch {
    if (!controller.signal.aborted && card._liveSetsWaveController === controller) {
      card.dataset.realWave = 'unavailable';
    }
  } finally {
    if (card._liveSetsWaveController === controller) card._liveSetsWaveController = null;
  }
}

function invalidateLiveSetsCardRequest(card) {
  const nextVersion = Number(card?._liveSetsRequestVersion || 0) + 1;
  if (card) card._liveSetsRequestVersion = nextVersion;
  return nextVersion;
}

function isCurrentLiveSetsCardRequest(card, requestVersion) {
  return Number(card?._liveSetsRequestVersion || 0) === requestVersion;
}

const pauseLiveSetsCardPlayer = (card) => {
  const audio = card?.querySelector('[data-livesets-audio]');
  if (!audio) return;
  invalidateLiveSetsCardRequest(card);
  audio.pause();
  card.classList.remove('is-playing-session');
};

// Pausing an audio element can leave its network request buffering in the
// background. A set change must fully release the old source so only the
// currently selected set competes for bandwidth and Worker capacity.
const releaseLiveSetsCardPlayer = (card) => {
  const audio = card?.querySelector('[data-livesets-audio]');
  if (!audio) return;
  invalidateLiveSetsCardRequest(card);
  card._liveSetsMetaController?.abort();
  card._liveSetsMetaController = null;
  card._liveSetsWaveController?.abort();
  card._liveSetsWaveController = null;
  if (card.dataset.realWave === 'loading') delete card.dataset.realWave;
  audio.pause();
  audio.removeAttribute('src');
  audio.replaceChildren();
  audio.load();
  delete card.dataset.audioOffset;
  delete card.dataset.totalDuration;
  delete card.dataset.waveLoaded;
  delete card.dataset.wavePlayed;
  card.style.removeProperty('--sessions-progress');
  const duration = card.querySelector('.sessions-card-duration');
  if (duration) duration.textContent = card.dataset.durationLabel || 'LiveSets';
  card.querySelectorAll('.sessions-card-wave span').forEach((bar) => {
    bar.classList.remove('is-played', 'is-loaded');
  });
  card.classList.remove('is-playing-session', 'is-buffering');
  setLiveSetsCardPlayerState(card, 'is-unloaded');
};

const setLiveSetsCardPlayerState = (card, state, message = '') => {
  const player = card?.querySelector('[data-livesets-player]');
  const status = card?.querySelector('[data-livesets-player-status]');
  if (!player) return;
  card.classList.remove('is-loading-session', 'is-session-ready', 'has-session-error');
  if (state === 'is-loading') card.classList.add('is-loading-session');
  if (state === 'is-ready') card.classList.add('is-session-ready');
  if (state === 'has-error') card.classList.add('has-session-error');
  player.classList.remove('is-unloaded', 'is-loading', 'is-ready', 'has-error');
  player.classList.add(state);
  if (status) status.textContent = message;
};

const loadLiveSetsCardPlayer = async (card) => {
  const audio = card?.querySelector('[data-livesets-audio]');
  if (!audio) return null;
  if (audio.querySelector('source')) return audio;

  const sessionId = card.dataset.livesetsSessionId || '';
  const requestVersion = invalidateLiveSetsCardRequest(card);
  const controller = new AbortController();
  card._liveSetsMetaController?.abort();
  card._liveSetsMetaController = controller;
  setLiveSetsCardPlayerState(card, 'is-loading', 'Loading session...');
  const meta = await fetchLiveSetsSessionMeta(sessionId, controller.signal);

  // The visitor may have selected another set while metadata was loading.
  // Do not attach an obsolete source or overwrite the current player state.
  if (controller.signal.aborted || !isCurrentLiveSetsCardRequest(card, requestVersion) || !card.classList.contains('active')) return null;
  if (card._liveSetsMetaController === controller) card._liveSetsMetaController = null;

  if (!meta?.urlAudio?.length) {
    setLiveSetsCardPlayerState(card, 'has-error', 'Player could not load right now.');
    return null;
  }

  if (meta.duration) card.dataset.totalDuration = String(meta.duration);
  audio.replaceChildren();
  // Prefer the proxy worker's /audio route (seekable byte ranges); the
  // browser falls back to LiveSets' own files if it is unavailable.
  const proxyBase = getLiveSetsProxyBase();
  const sources = [
    ...(proxyBase ? [{ url: `${proxyBase}audio/${encodeURIComponent(sessionId)}`, type: 'audio/mpeg' }] : []),
    ...meta.urlAudio,
  ];
  sources.forEach((sourceData) => {
    const source = document.createElement('source');
    source.src = sourceData.url;
    if (sourceData.type) source.type = sourceData.type;
    audio.appendChild(source);
  });
  audio.load();
  setLiveSetsCardPlayerState(card, 'is-ready');
  return audio;
};

const playLiveSetsCard = async (card) => {
  if (!card || !card.classList.contains('active') || card.classList.contains('is-loading-session')) return;
  const audio = await loadLiveSetsCardPlayer(card);
  if (!audio || !card.classList.contains('active')) return;

  getLiveSetsSessionCards().forEach((otherCard) => {
    if (otherCard !== card) releaseLiveSetsCardPlayer(otherCard);
  });

  try {
    await audio.play();
    setLiveSetsCardPlayerState(card, 'is-ready');
    card.classList.add('is-playing-session');
  } catch (error) {
    if (error.name === 'AbortError' || !card.classList.contains('active')) return;
    setLiveSetsCardPlayerState(card, 'has-error', 'Playback could not start. Try Play session again.');
  }
};

const prepareLiveSetsSessionClone = (slide) => {
  const clone = slide.cloneNode(true);
  clone.classList.remove('active');
  clone.dataset.sessionsClone = 'true';
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('.sessions-card').forEach((card) => {
    card.classList.remove('active');
    card.dataset.sessionsClone = 'true';
    card.removeAttribute('data-livesets-session');
    card.removeAttribute('data-livesets-session-id');
    card.removeAttribute('data-livesets-session-url');
    card.removeAttribute('aria-current');
    card.removeAttribute('aria-label');
    card.removeAttribute('role');
    card.tabIndex = -1;
    card.querySelectorAll('[data-livesets-audio]').forEach((audio) => {
      audio.pause();
      audio.replaceChildren();
    });
    card.querySelectorAll('[data-livesets-player]').forEach((player) => {
      player.classList.remove('is-loading', 'is-ready', 'has-error');
      player.classList.add('is-unloaded');
    });
  });
  return clone;
};

const addLiveSetsSessionClones = (list) => {
  const slides = [...list.querySelectorAll('.sessions-slide')];
  if (slides.length < 2) return;
  list.prepend(prepareLiveSetsSessionClone(slides[slides.length - 1]));
  list.appendChild(prepareLiveSetsSessionClone(slides[0]));
};

const prepareYoutubeClone = (slide) => {
  const clone = slide.cloneNode(true);
  clone.dataset.youtubeClone = 'true';
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('.youtube-card').forEach((card) => {
    card.classList.remove('active');
    card.dataset.youtubeClone = 'true';
    card.removeAttribute('data-youtube-video');
    card.removeAttribute('aria-current');
    card.removeAttribute('aria-label');
    card.removeAttribute('role');
    card.tabIndex = -1;
  });
  clone.querySelectorAll('[data-youtube-frame]').forEach((frame) => {
    frame.removeAttribute('src');
  });
  clone.querySelectorAll('[data-youtube-player]').forEach((player) => {
    player.classList.remove('is-loaded');
  });
  return clone;
};

const addYoutubeClones = (list) => {
  const slides = [...list.querySelectorAll('.youtube-slide')];
  if (slides.length < 2) return;
  list.prepend(prepareYoutubeClone(slides[slides.length - 1]));
  list.appendChild(prepareYoutubeClone(slides[0]));
};

const renderYoutubeVideos = () => {
  if (!youtubeVideoLists.length) return;
  youtubeVideoLists.forEach((list) => {
    list.replaceChildren();
    YOUTUBE_VIDEOS.forEach((video, index) => {
      const slide = document.createElement('div');
      slide.className = 'youtube-slide';
      const card = document.createElement('article');
      card.className = `youtube-card${index === 0 ? ' active' : ''}`;
      card.dataset.youtubeVideo = String(index);
      card.setAttribute('role', 'button');
      card.tabIndex = index === 0 ? 0 : -1;
      card.setAttribute('aria-current', index === 0 ? 'true' : 'false');
      card.setAttribute('aria-label', `Play ${video.title} on YouTube`);

      const top = document.createElement('span');
      top.className = 'youtube-card-top';
      const source = document.createElement('span');
      source.className = 'youtube-card-source';
      source.textContent = 'YouTube';
      top.append(source);

      const player = document.createElement('span');
      player.className = 'youtube-card-player';
      player.dataset.youtubePlayer = '';
      player.style.setProperty('--youtube-thumb', `url("${video.thumbnail}")`);
      const frame = document.createElement('iframe');
      frame.className = 'youtube-card-frame';
      frame.title = `${video.title} YouTube video`;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      frame.dataset.youtubeFrame = '';
      frame.dataset.youtubeSrc = video.embedUrl;
      frame.dataset.youtubeAutoplaySrc = video.autoplayUrl;
      player.appendChild(frame);

      const playButton = document.createElement('button');
      playButton.className = 'youtube-card-play';
      playButton.type = 'button';
      playButton.dataset.youtubePlay = '';
      playButton.setAttribute('aria-label', `Play ${video.title}`);
      playButton.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';
      player.appendChild(playButton);

      // Generated cover (brand art, follows the theme) instead of YouTube's
      // own thumbnail; hidden once the embed loads
      player.prepend(createYoutubePreview(video, index));

      // Mockup chip on the thumbnail: these videos are unlisted on YouTube
      const chip = document.createElement('span');
      chip.className = 'youtube-card-chip';
      chip.textContent = 'Unlisted';
      player.appendChild(chip);

      const note = document.createElement('span');
      note.className = 'youtube-card-note';
      note.textContent = 'HQ audio in Sessions';

      // Card body: label ("Video 01 · Unlisted"), the name (shown in the desktop
      // rows only; the featured card has it on the cover) and the actions
      const body = document.createElement('span');
      body.className = 'youtube-card-body';
      const info = document.createElement('span');
      info.className = 'youtube-card-info';
      const kicker = document.createElement('span');
      kicker.className = 'youtube-card-kicker';
      kicker.textContent = `Video ${String(index + 1).padStart(2, '0')} · Unlisted`;
      const name = document.createElement('span');
      name.className = 'youtube-card-name';
      name.textContent = String(video.title || '').replace(/^cidirilk_/i, '').replace(/_/g, ' ').trim();
      info.append(name, kicker);
      const actions = document.createElement('span');
      actions.className = 'youtube-card-actions';
      const playCta = document.createElement('button');
      playCta.type = 'button';
      playCta.className = 'youtube-card-cta is-primary';
      playCta.dataset.youtubePlay = '';
      playCta.setAttribute('aria-label', `Play ${video.title}`);
      playCta.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i><span>Play video</span>';
      const hq = document.createElement('a');
      hq.className = 'youtube-card-cta';
      hq.href = '#sessions';
      hq.dataset.youtubeHq = '';
      hq.title = 'HQ audio in Sessions';
      hq.setAttribute('aria-label', 'HQ audio in Sessions');
      hq.innerHTML = '<i class="fa-solid fa-headphones" aria-hidden="true"></i><span>HQ audio</span>';
      // Shown instead of "Play video" while the embed is loaded: a way out if
      // the embedded player is unavailable on a device ("Watch on YouTube")
      const open = document.createElement('a');
      open.className = 'youtube-card-cta is-primary youtube-card-open';
      open.href = video.url;
      open.target = '_blank';
      open.rel = 'noopener';
      open.setAttribute('aria-label', `Open ${video.title} on YouTube (opens in a new tab)`);
      open.innerHTML = '<i class="fa-brands fa-youtube" aria-hidden="true"></i><span>YouTube</span>';
      // Our play/pause for the loaded embed (shown only while it is loaded)
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'youtube-card-cta youtube-card-toggle';
      toggle.dataset.youtubeToggle = '';
      toggle.dataset.title = video.title;
      toggle.setAttribute('aria-label', `Pause ${video.title}`);
      toggle.innerHTML = '<i class="fa-solid fa-pause" aria-hidden="true"></i><span>Pause</span>';
      actions.append(toggle, playCta, open, hq);
      const error = document.createElement('span');
      error.className = 'youtube-card-error';
      error.setAttribute('role', 'status');
      error.textContent = 'This video can’t play here. Watch it on YouTube.';
      body.append(info, actions, error);

      // Desktop rows: small play button on the right
      const rowPlay = document.createElement('span');
      rowPlay.className = 'youtube-card-rowplay';
      rowPlay.setAttribute('aria-hidden', 'true');
      rowPlay.innerHTML = '<i class="fa-solid fa-play"></i>';

      card.append(top, player, note, body, rowPlay);
      slide.appendChild(card);
      list.appendChild(slide);
    });
    addYoutubeClones(list);
  });
  renderYoutubeCarouselDots(YOUTUBE_VIDEOS.length, 0);
  setActiveYoutubeVideo(0, { instant: true });
};

const renderLiveSetsSessions = (sessions) => {
  const visibleSessions = sessions.slice(0, MEDIA_CAROUSEL_LIMIT);
  renderedLiveSetsSignature = getLiveSetsSessionsSignature(visibleSessions);
  liveSetsSessionLists.forEach((list) => {
    list.replaceChildren();
    visibleSessions.forEach((session, index) => {
      const slide = document.createElement('div');
      slide.className = 'sessions-slide';
      const sessionId = getLiveSetsSessionId(session);
      const card = document.createElement('article');
      card.className = `sessions-card${index === 0 ? ' active' : ''}`;
      card.dataset.livesetsSession = String(index);
      card.dataset.livesetsSessionId = sessionId;
      card.dataset.livesetsSessionUrl = session.url;
      card.setAttribute('role', 'button');
      card.tabIndex = index === 0 || consoleListQuery.matches ? 0 : -1;
      card.setAttribute('aria-current', index === 0 ? 'true' : 'false');
      card.setAttribute('aria-label', `Play ${session.title} from LiveSets`);
      if (session.artwork) {
        card.style.setProperty('--sessions-artwork', `url("${session.artwork}")`);
      }

      const top = document.createElement('span');
      top.className = 'sessions-card-top';
      const source = document.createElement('span');
      source.className = 'sessions-card-source';
      source.textContent = 'LiveSets';
      const duration = document.createElement('span');
      duration.className = 'sessions-card-duration';
      duration.textContent = session.duration || 'LiveSets';
      if (session.duration) card.dataset.durationLabel = session.duration;
      top.append(source, duration);

      const title = document.createElement('strong');
      title.className = 'sessions-card-title';
      title.textContent = session.title;

      const meta = document.createElement('span');
      meta.className = 'sessions-card-meta';
      [
        ['fa-solid fa-wave-square', session.genre],
        ['fa-regular fa-clock', session.age],
      ].forEach(([icon, value]) => {
        if (!value) return;
        const chip = document.createElement('span');
        chip.className = 'sessions-card-chip';
        chip.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
        chip.append(document.createTextNode(value));
        meta.appendChild(chip);
      });

      const action = document.createElement('span');
      action.className = 'sessions-card-action';
      action.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';
      action.append(document.createTextNode('Play session'));

      const player = document.createElement('span');
      player.className = 'sessions-card-player is-unloaded';
      player.dataset.livesetsPlayer = '';
      const audio = document.createElement('audio');
      audio.className = 'sessions-card-audio';
      audio.controls = true;
      audio.preload = 'none';
      audio.dataset.livesetsAudio = '';
      audio.addEventListener('play', () => setLiveSetsCardPlaying(card, session.title, true));
      audio.addEventListener('pause', () => {
        setLiveSetsCardPlaying(card, session.title, false);
        setTimeout(flushPendingLiveSetsSessions, 0);
      });
      audio.addEventListener('ended', () => {
        setLiveSetsCardPlaying(card, session.title, false);
        setTimeout(flushPendingLiveSetsSessions, 0);
      });
      audio.addEventListener('timeupdate', () => updateLiveSetsCardProgress(card, audio));
      audio.addEventListener('progress', () => updateLiveSetsCardLoaded(card, audio));
      audio.addEventListener('waiting', () => card.classList.add('is-buffering'));
      ['playing', 'pause', 'ended', 'error'].forEach((type) =>
        audio.addEventListener(type, () => card.classList.remove('is-buffering')),
      );
      audio.addEventListener('timeupdate', () => updateLiveSetsCardLoaded(card, audio));
      const playerStatus = document.createElement('span');
      playerStatus.className = 'sessions-card-player-status';
      playerStatus.dataset.livesetsPlayerStatus = '';
      playerStatus.setAttribute('role', 'status');
      player.append(audio, playerStatus);

      // Desktop console list (mockup): featured card + rows. These pieces are
      // hidden in the mobile carousel.
      const kicker = document.createElement('span');
      kicker.className = 'sessions-card-kicker';
      // Short enough for one line on phones (the section is LiveSets already)
      kicker.textContent = (index === 0 ? ['Latest', 'LiveSets', session.genre] : [session.genre, session.age])
        .filter(Boolean)
        .join(' · ');
      const line = document.createElement('span');
      line.className = 'sessions-card-line';
      line.textContent = ['LiveSets', session.genre, session.age].filter(Boolean).join(' · ');
      const play = document.createElement('span');
      play.className = 'sessions-card-play';
      play.setAttribute('aria-hidden', 'true');
      play.innerHTML = '<i class="fa-solid fa-play"></i><i class="fa-solid fa-pause"></i>';
      const hq = document.createElement('span');
      hq.className = 'sessions-card-hq';
      hq.textContent = 'HQ';

      card.append(top, title, meta, action, player, kicker, line, play, hq, createLiveSetsWave(sessionId));
      slide.appendChild(card);
      list.appendChild(slide);
    });
    addLiveSetsSessionClones(list);
  });
  renderLiveSetsCarouselDots(visibleSessions.length, 0);
  setActiveLiveSetsSession(0, { instant: true });
};

const flushPendingLiveSetsSessions = () => {
  if (!pendingLiveSetsSessions || hasPlayingLiveSetsSession()) return;
  const sessions = pendingLiveSetsSessions;
  pendingLiveSetsSessions = null;
  renderLiveSetsSessions(sessions);
};

const refreshLiveSetsSessions = (sessions) => {
  if (getLiveSetsSessionsSignature(sessions) === renderedLiveSetsSignature) return;
  if (hasPlayingLiveSetsSession()) {
    pendingLiveSetsSessions = sessions;
    return;
  }
  renderLiveSetsSessions(sessions);
};

const initLiveSetsSessions = async () => {
  if (!liveSetsSessionLists.length) return;
  const cachedSessions = readCachedLiveSetsSessions();
  if (cachedSessions.length) {
    renderLiveSetsSessions(cachedSessions);
  } else {
    renderLiveSetsSessionsStatus('Getting signals from LiveSets...', true);
  }

  const sessions = await fetchLiveSetsSessions();
  if (sessions.length) {
    cacheLiveSetsSessions(sessions);
    refreshLiveSetsSessions(sessions);
  } else if (!cachedSessions.length) {
    renderLiveSetsSessions(LIVESETS_FALLBACK_SESSIONS);
  }
};

const moveLiveSetsSessions = (direction) => {
  const cards = getLiveSetsSessionCards();
  if (!cards.length) return;
  const currentIndex = getActiveLiveSetsSessionIndex();
  const nextIndex = (currentIndex + direction + cards.length) % cards.length;
  const wrapsAround =
    (direction < 0 && currentIndex === 0) ||
    (direction > 0 && currentIndex === cards.length - 1);
  setActiveLiveSetsSession(nextIndex, { wrapDirection: wrapsAround ? direction : 0 });
};

const moveYoutubeCarousel = (direction) => {
  const cards = getYoutubeCards();
  if (!cards.length) return;
  const currentIndex = getActiveYoutubeVideoIndex();
  const nextIndex = (currentIndex + direction + cards.length) % cards.length;
  const wrapsAround =
    (direction < 0 && currentIndex === 0) ||
    (direction > 0 && currentIndex === cards.length - 1);
  setActiveYoutubeVideo(nextIndex, { wrapDirection: wrapsAround ? direction : 0 });
};

liveSetsSessionLists.forEach((list) => {
  list.addEventListener('click', (event) => {
    if (event.target.closest('[data-livesets-audio]')) return;
    const card = event.target.closest('.sessions-card[data-livesets-session]');
    if (!card) return;
    // Phones use the same player as the desktop console: play/pause on the
    // selected card, tap the waveform to skip
    if (consoleListQuery.matches || card.classList.contains('active')) {
      toggleConsoleLiveSetsSession(card, event);
      return;
    }
    playLiveSetsCard(card);
  });

  list.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const card = event.target.closest('.sessions-card[data-livesets-session]');
    if (!card || event.target.closest('[data-livesets-audio]')) return;
    event.preventDefault();
    if (consoleListQuery.matches || card.classList.contains('active')) {
      toggleConsoleLiveSetsSession(card);
      return;
    }
    playLiveSetsCard(card);
  });
});

youtubeVideoLists.forEach((list) => {
  list.addEventListener('click', (event) => {
    // "HQ audio in Sessions": open the Sessions tab on the desktop console;
    // on smaller screens the #sessions anchor scrolls there as usual.
    const hq = event.target.closest('[data-youtube-hq]');
    if (hq) {
      const sessionsTab = document.querySelector('.card-tabs .tab-button[data-tab="sessions"]');
      if (consoleListQuery.matches && sessionsTab) {
        event.preventDefault();
        sessionsTab.click();
      }
      return;
    }
    // Our play/pause for a loaded video
    const toggle = event.target.closest('[data-youtube-toggle]');
    if (toggle) {
      const player = toggle.closest('.youtube-card')?._ytPlayer;
      if (player?.getPlayerState) {
        if (player.getPlayerState() === window.YT?.PlayerState?.PLAYING) player.pauseVideo();
        else player.playVideo();
      }
      return;
    }
    // Desktop rows: a click anywhere on a non-featured video features and plays it
    const rowCard = event.target.closest('.youtube-card[data-youtube-video]:not(.active)');
    if (consoleListQuery.matches && rowCard && !event.target.closest('a')) {
      setActiveYoutubeVideo(Number.parseInt(rowCard.dataset.youtubeVideo || '0', 10), { instant: true });
      playYoutubeCard(rowCard);
      rowCard.closest('.tab-panel')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const playButton = event.target.closest('[data-youtube-play]');
    if (!playButton) return;
    const card = playButton.closest('.youtube-card[data-youtube-video]');
    event.preventDefault();
    // Desktop grid: any card can be played; it becomes the active (featured) one
    if (consoleListQuery.matches && card && !card.classList.contains('active')) {
      setActiveYoutubeVideo(Number.parseInt(card.dataset.youtubeVideo || '0', 10), { instant: true });
    }
    playYoutubeCard(card);
    if (consoleListQuery.matches) card?.closest('.tab-panel')?.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

youtubeVideoLists.forEach((list) => {
  list.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || !consoleListQuery.matches) return;
    const row = event.target.closest?.('.youtube-card[data-youtube-video]:not(.active)');
    if (!row || event.target !== row) return;
    event.preventDefault();
    row.click();
  });
});

liveSetsCarouselPrev?.addEventListener('click', () => moveLiveSetsSessions(-1));
liveSetsCarouselNext?.addEventListener('click', () => moveLiveSetsSessions(1));
youtubeCarouselPrev?.addEventListener('click', () => moveYoutubeCarousel(-1));
youtubeCarouselNext?.addEventListener('click', () => moveYoutubeCarousel(1));

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
initSoundCloudEpisodeLists();
renderYoutubeVideos();
initLiveSetsSessions();
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
    if (consoleListQuery.matches) {
      setConsoleListSlides(track);
      return;
    }
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
    if (consoleListQuery.matches) return;
    if (currentIndex > 0) {
      currentIndex--;
      updateCarousel();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (consoleListQuery.matches) return;
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

  consoleListQuery.addEventListener('change', () => updateCarousel());

  updateCarousel();
};

// Collaborations Carousel functionality
const initCollabCarousel = () => {
  const carousel = document.querySelector('[data-carousel-collab]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-carousel-track-collab]');
  if (!track) return;

  const slides = Array.from(track.children);
  const prevBtn = carousel.querySelector('[data-carousel-prev-collab]');
  const nextBtn = carousel.querySelector('[data-carousel-next-collab]');
  const dotsContainer = carousel.querySelector('[data-carousel-dots-collab]');
  if (!slides.length || !prevBtn || !nextBtn || !dotsContainer) return;

  let currentIndex = 0;
  let activePosition = slides.length > 1 ? 1 : 0;
  let isAnimating = false;
  let resizeFrame = null;

  slides.forEach((slide, index) => {
    slide.dataset.carouselIndex = String(index);
  });

  if (slides.length > 1) {
    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);
    firstClone.dataset.carouselIndex = '0';
    lastClone.dataset.carouselIndex = String(slides.length - 1);
    firstClone.dataset.carouselClone = 'true';
    lastClone.dataset.carouselClone = 'true';
    firstClone.classList.add('is-carousel-clone');
    lastClone.classList.add('is-carousel-clone');
    track.insertBefore(lastClone, slides[0]);
    track.appendChild(firstClone);
  }

  const renderedSlides = Array.from(track.children);

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

  const setTrackPosition = (animate = true) => {
    const activeSlide = renderedSlides[activePosition];
    if (!activeSlide) return;

    if (!animate) {
      track.style.transition = 'none';
    }

    const offset =
      track.clientWidth / 2 - activeSlide.offsetLeft - activeSlide.offsetWidth / 2;
    track.style.transform = `translateX(${offset}px)`;

    if (!animate) {
      void track.offsetHeight;
      track.style.transition = '';
    }
  };

  const updateCarousel = (animate = true) => {
    if (consoleListQuery.matches) {
      isAnimating = false;
      setConsoleListSlides(track);
      return;
    }

    if (animate) {
      isAnimating = true;
    } else {
      isAnimating = false;
    }

    setTrackPosition(animate);

    // Only the current slide is interactive; neighbours are inert so a single
    // tap can never open more than one link.
    renderedSlides.forEach((slide, index) => {
      const isCurrent = index === activePosition;
      const isClone = slide.dataset.carouselClone === 'true';
      slide.classList.toggle('is-current', isCurrent);
      slide.setAttribute('aria-hidden', String(!isCurrent || isClone));
      slide.querySelectorAll('a, button, [tabindex]').forEach((el) => {
        el.tabIndex = isCurrent && !isClone ? 0 : -1;
      });
    });

    // Update dots
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });

    prevBtn.disabled = false;
    nextBtn.disabled = false;
  };

  const goToSlide = (index) => {
    if (slides.length <= 1) return;
    if (isAnimating) return;
    if (index === currentIndex) return;

    currentIndex = (index + slides.length) % slides.length;
    activePosition = currentIndex + (slides.length > 1 ? 1 : 0);
    updateCarousel();
  };

  prevBtn.addEventListener('click', () => {
    if (slides.length <= 1 || consoleListQuery.matches) return;
    if (isAnimating) return;

    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    activePosition -= 1;
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    if (slides.length <= 1 || consoleListQuery.matches) return;
    if (isAnimating) return;

    currentIndex = (currentIndex + 1) % slides.length;
    activePosition += 1;
    updateCarousel();
  });

  track.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'transform' || slides.length <= 1) return;

    if (activePosition === 0) {
      activePosition = slides.length;
      updateCarousel(false);
    } else if (activePosition === renderedSlides.length - 1) {
      activePosition = 1;
      updateCarousel(false);
    }

    isAnimating = false;
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

  window.addEventListener('resize', () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      updateCarousel(false);
      resizeFrame = null;
    });
  });

  window.addEventListener('cidirilk:tabchange', (event) => {
    if (event.detail?.target !== 'collab') return;

    requestAnimationFrame(() => {
      updateCarousel(false);
    });
  });

  consoleListQuery.addEventListener('change', () => updateCarousel(false));

  updateCarousel(false);
};

// Shop Carousel functionality
const initShopCarousel = () => {
  const carousel = document.querySelector('[data-shop-carousel]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-shop-track]');
  const slides = Array.from(track?.children || []);
  const prevBtn = carousel.querySelector('[data-shop-prev]');
  const nextBtn = carousel.querySelector('[data-shop-next]');
  const dotsContainer = carousel.querySelector('[data-shop-dots]');
  if (!track || !slides.length || !prevBtn || !nextBtn || !dotsContainer) return;

  let currentIndex = 0;
  let activePosition = slides.length > 1 ? 1 : 0;
  let isAnimating = false;

  slides.forEach((slide, index) => {
    slide.dataset.carouselIndex = String(index);
  });

  if (slides.length > 1) {
    const firstClone = slides[0].cloneNode(true);
    const lastClone = slides[slides.length - 1].cloneNode(true);
    firstClone.dataset.carouselIndex = '0';
    lastClone.dataset.carouselIndex = String(slides.length - 1);
    firstClone.dataset.carouselClone = 'true';
    lastClone.dataset.carouselClone = 'true';
    firstClone.classList.add('is-carousel-clone');
    lastClone.classList.add('is-carousel-clone');
    track.insertBefore(lastClone, slides[0]);
    track.appendChild(firstClone);
  }

  const renderedSlides = Array.from(track.children);

  slides.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.classList.add('carousel-dot');
    dot.setAttribute('aria-label', `Go to shop item ${index + 1}`);
    dot.addEventListener('click', () => goToSlide(index));
    dotsContainer.appendChild(dot);
  });

  const dots = Array.from(dotsContainer.children);

  const setTrackPosition = (animate = true) => {
    if (!animate) {
      track.style.transition = 'none';
    }

    track.style.transform = `translateX(-${activePosition * 100}%)`;

    if (!animate) {
      void track.offsetHeight;
      track.style.transition = '';
    }
  };

  const setSlideInteractivity = () => {
    renderedSlides.forEach((slide, index) => {
      const isCurrent = index === activePosition;
      const isClone = slide.dataset.carouselClone === 'true';
      slide.classList.toggle('is-current', isCurrent);
      slide.setAttribute('aria-hidden', String(!isCurrent || isClone));
      slide.querySelectorAll('a, button, [tabindex]').forEach((el) => {
        el.tabIndex = isCurrent && !isClone ? 0 : -1;
      });
    });
  };

  const updateCarousel = (animate = true) => {
    if (consoleListQuery.matches) {
      isAnimating = false;
      setConsoleListSlides(track);
      return;
    }

    if (animate) {
      isAnimating = true;
    } else {
      isAnimating = false;
    }

    setTrackPosition(animate);

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    setSlideInteractivity();
  };

  function goToSlide(index) {
    if (slides.length <= 1) return;
    if (isAnimating) return;
    if (index === currentIndex) return;

    currentIndex = (index + slides.length) % slides.length;
    activePosition = currentIndex + 1;
    updateCarousel();
  }

  prevBtn.addEventListener('click', () => {
    if (slides.length <= 1 || consoleListQuery.matches) return;
    if (isAnimating) return;

    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    activePosition -= 1;
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    if (slides.length <= 1 || consoleListQuery.matches) return;
    if (isAnimating) return;

    currentIndex = (currentIndex + 1) % slides.length;
    activePosition += 1;
    updateCarousel();
  });

  track.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'transform' || slides.length <= 1) return;

    if (activePosition === 0) {
      activePosition = slides.length;
      updateCarousel(false);
    } else if (activePosition === renderedSlides.length - 1) {
      activePosition = 1;
      updateCarousel(false);
    }

    isAnimating = false;
  });

  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prevBtn.click();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextBtn.click();
    }
  });

  let touchStartX = 0;
  let touchEndX = 0;

  carousel.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  carousel.addEventListener('touchend', (event) => {
    touchEndX = event.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) <= 50) return;
    if (diff > 0) {
      nextBtn.click();
    } else {
      prevBtn.click();
    }
  }, { passive: true });

  consoleListQuery.addEventListener('change', () => updateCarousel(false));

  updateCarousel(false);
};

// Shop image preview modal.
const initShopModal = () => {
  const modal = document.querySelector('[data-shop-modal]');
  const overlay = document.querySelector('[data-shop-modal-overlay]');
  const closeBtn = document.querySelector('[data-shop-modal-close]');
  const title = document.querySelector('[data-shop-modal-title]');
  const image = document.querySelector('[data-shop-modal-image]');
  const triggers = document.querySelectorAll('[data-shop-image]');
  const modalReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const modalCloseDuration = 260;
  let modalCloseTimer = null;
  let lastFocus = null;

  if (!modal || !image || !triggers.length) return;

  const focusCloseButton = () => {
    try {
      closeBtn?.focus({ preventScroll: true });
    } catch (e) {
      closeBtn?.focus();
    }
  };

  const openModal = (trigger) => {
    const imageSrc = trigger.getAttribute('data-shop-image');
    const imageTitle = trigger.getAttribute('data-shop-title') || 'Artifact preview';
    const previewImage = trigger.querySelector('img');
    if (!imageSrc) return;

    if (modalCloseTimer) {
      clearTimeout(modalCloseTimer);
      modalCloseTimer = null;
    }

    lastFocus = trigger;
    title.textContent = imageTitle;
    image.src = imageSrc;
    image.alt = previewImage?.alt || imageTitle;
    modal.classList.remove('is-closing');
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(focusCloseButton, 80);
  };

  const closeModal = () => {
    if (modal.hasAttribute('hidden') || modal.classList.contains('is-closing')) return;

    const hideModal = () => {
      modal.setAttribute('hidden', '');
      modal.classList.remove('is-closing');
      document.body.style.overflow = '';
      modalCloseTimer = null;
      if (lastFocus) {
        try {
          lastFocus.focus({ preventScroll: true });
        } catch (e) {
          lastFocus.focus();
        }
      }
    };

    if (modalReducedMotion) {
      hideModal();
      return;
    }

    modal.classList.add('is-closing');
    modalCloseTimer = setTimeout(hideModal, modalCloseDuration);
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openModal(trigger));
  });

  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', closeModal);

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') trapFocus(event, modal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hasAttribute('hidden')) {
      closeModal();
    }
  });
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
  let lastFocus = null;

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

  // Collaboration data (facts from each promoter's Resident Advisor page)
  const collabData = {
    chacha: {
      icon: 'fa-users',
      title: 'ChaCha',
      content: `
        <h3>About ChaCha</h3>
        <p>ChaCha is a Cyprus DJ duo, two friends who met at a warehouse party and have been sharing decks since. They run under the name <strong>CC Grooves</strong>, with the &ldquo;00357&rdquo; tag nodding to Cyprus&rsquo; dialling code.</p>

        <h3>Sound</h3>
        <p>Groove-led sets built to keep a floor moving, with the duo&rsquo;s own motto: <strong>expect the unexpected</strong>.</p>

        <h3>Highlights</h3>
        <ul><li>Played the opening night of S//IP in Nicosia (February 2025)</li><li>Regular names on SYNESTHESIA line-ups</li><li>Also billed by Mind The Riot</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/dj/chacha/biography" target="_blank" rel="noopener">Resident Advisor</a> · <a href="https://www.instagram.com/cc_grooves_00357" target="_blank" rel="noopener">Instagram</a> · <a href="https://soundcloud.com/cc_grooves_00357" target="_blank" rel="noopener">SoundCloud</a></p>
      `
    },
    synesthesia: {
      icon: 'fa-brain',
      title: 'SYNESTHESIA',
      content: `
        <h3>About SYNESTHESIA</h3>
        <p>SYNESTHESIA Events is a Cyprus techno promoter based mainly in Nicosia, hosting club nights and festival-scale editions at spaces like Agora Anexartisias and S//IP, with dates in Limassol too.</p>

        <h3>Events</h3>
        <p>Since its first night with Nakadia in January 2023 it has brought international names to the island, and runs the yearly carnival party <strong>Old City Technivals</strong> in Nicosia&rsquo;s old town.</p>

        <h3>Highlights</h3>
        <ul><li>Guests include Nakadia, Luigi Madonna, Ida Engberg, DAX J and Metodi Hristov</li><li>Old City Technivals: 4th edition in 2025</li><li>5 Years SYNESTHESIA, Festival Edition (July 2026)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/115743" target="_blank" rel="noopener">Resident Advisor</a> · <a href="https://synesthesiaevents.com/" target="_blank" rel="noopener">Website</a></p>
      `
    },
    mindriot: {
      icon: 'fa-bolt',
      title: 'Mind The Riot',
      content: `
        <h3>About Mind The Riot</h3>
        <p>Mind The Riot is a Cyprus party series that started with <strong>Acid Leak</strong> in 2022 and returns every so often with a tight line-up of local selectors.</p>

        <h3>Events</h3>
        <p>From its own nights to team-ups with SYNESTHESIA and BCCO, it keeps the focus on the local scene and the people behind it.</p>

        <h3>With CIDIRILK</h3>
        <ul><li>Mind The Return (January 2024)</li><li>Line-ups also featured OUST, KONTELLO, ChaCha, Kirozen and Argy K</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/106564" target="_blank" rel="noopener">Resident Advisor</a></p>
      `
    },
    boilerhouse: {
      icon: 'fa-fire',
      title: 'Boiler House',
      content: `
        <h3>About Boiler House</h3>
        <p>Boiler House is a Cyprus techno party series that began at the Lakatamia Amphitheatre in 2021 and has since moved through S//IP, Castle Club and Ktima Camelot, with a stop at AUX Club in Athens.</p>

        <h3>Events</h3>
        <p>Five years in (marked with a mini-festival in December 2025), it pairs international guests with local residents.</p>

        <h3>Highlights</h3>
        <ul><li>Guests include Raven (Rekids), Carla Schmitt, Stella Bossi, Nusha, PALØ and ANNĒ</li><li>With CIDIRILK: Boiler House with Cidirilk, Dreus &amp; Valdés (May 2023)</li><li>With CIDIRILK: the Raven night (December 2023)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/102310" target="_blank" rel="noopener">Resident Advisor</a></p>
      `
    },
    indigo: {
      icon: 'fa-circle-half-stroke',
      title: 'Indigo',
      content: `
        <h3>About Indigo</h3>
        <p>Indigo Underground Techno is a Cyprus collective running nights since 2023, often at locations revealed only to ticket holders, plus dates in the Limassol area and at S//IP in Nicosia.</p>

        <h3>Series</h3>
        <p>Its nights run as separate series: <strong>ØRPHIC</strong>, <strong>PARAMNESIA</strong>, <strong>PRV.PROJECT</strong> and <strong>The Warehouse Project</strong>.</p>

        <h3>Highlights</h3>
        <ul><li>Residents and regulars: Argy K, Atesh K. and SIĈK</li><li>Guests include Oliver Rosemann</li><li>Deep, hypnotic underground sound</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/129207" target="_blank" rel="noopener">Resident Advisor</a></p>
      `
    },
    desolate: {
      icon: 'fa-moon',
      title: 'Desolate',
      content: `
        <h3>About Desolate</h3>
        <p>Desolate is a young party series built around high-energy grooves, launched in January 2026 at Dusty Munky Bar in central Limassol.</p>

        <h3>Events</h3>
        <p>Numbered volumes at Dusty Munky, and team-ups beyond Limassol such as Velvet Void x Desolate with Tasha Safari all night long at S//IP, Nicosia (October 2026).</p>

        <h3>With CIDIRILK</h3>
        <ul><li>Desolate Vol.2 at Dusty Munky Bar (February 2026)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/178964" target="_blank" rel="noopener">Resident Advisor</a></p>
      `
    },
    beonix: {
      icon: 'fa-sun',
      title: 'BEON1X Festival',
      content: `
        <h3>About BEON1X</h3>
        <p>BEON1X (BEONIX) is one of the island&rsquo;s largest electronic music festivals, bringing world-class headliners to Cyprus.</p>

        <h3>Editions</h3>
        <p>The 2022 edition took over CTO Beach in Larnaca; the 2026 edition ran over three days (25–27 September) at ETKO in Limassol.</p>

        <h3>Highlights</h3>
        <ul><li>2022 line-up: Carl Cox, Sven Väth, Boris Brejcha, Jamie Jones, Luciano, Paul Kalkbrenner, John Digweed and Sasha</li><li>2026 line-up: Adam Beyer, CamelPhat and more</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/111485" target="_blank" rel="noopener">Resident Advisor</a> · <a href="https://beonix.art" target="_blank" rel="noopener">Website</a></p>
      `
    },
    slip: {
      icon: 'fa-building',
      title: 'S//IP',
      content: `
        <h3>About S//IP</h3>
        <p>S//IP is a Nicosia club inside the brutalist Zena&rsquo;s Palace complex, open since March 2024 and now one of the city&rsquo;s key rooms for techno and electronic music.</p>

        <h3>Programme</h3>
        <p>Its own nights sit alongside the island&rsquo;s collectives: Boiler House, SYNESTHESIA, Indigo and Techno Habits have all hosted there.</p>

        <h3>Highlights</h3>
        <ul><li>Guests include Rene Wise, Stella Fiore (Perlon), JUUL EXLER and Tapefeed</li><li>With CIDIRILK: S//IP x Rene Wise, Flux Magnetic, Valdés b2b Cidirilk (April 2024)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/138477" target="_blank" rel="noopener">Resident Advisor</a></p>
      `
    },
    technoblades: {
      icon: 'fa-mountain-sun',
      title: 'Techno Blades',
      content: `
        <h3>About Techno Blades</h3>
        <p>Techno Blades throws underground parties in unusual locations around Paphos, away from the usual club circuit.</p>

        <h3>Events</h3>
        <p>Its <strong>Winery Rave</strong> took the dancefloor to Lagria Winery in Salamiou village (April 2024).</p>

        <h3>With CIDIRILK</h3>
        <ul><li>Winery Rave with Kirozen and CIDIRILK (April 2024)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/138825" target="_blank" rel="noopener">Resident Advisor</a></p>
      `
    },
    technohabits: {
      icon: 'fa-repeat',
      title: 'Techno Habits Nicosia',
      content: `
        <h3>About Techno Habits</h3>
        <p>Techno Habits Nicosia is a techno collective running club nights, Habits Gathering events and the THN podcast, with nights on Resident Advisor since 2019.</p>

        <h3>Events</h3>
        <p>It has brought some of techno&rsquo;s biggest names to Nicosia, and celebrated <strong>THN Podcast #100</strong> with a party in June 2025.</p>

        <h3>Highlights</h3>
        <ul><li>Headliners include Ben Klock, Kobosil, Amelie Lens, Rødhåd, Chris Liebing, Recondite, Sam Paganini and Keith Carnal</li><li>With CIDIRILK: WOO York (State Club, November 2021), Chris Liebing (Ktima Camelot, March 2022) and Rødhåd (Ktima Wishes, October 2022)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/103534" target="_blank" rel="noopener">Resident Advisor</a> · <a href="https://www.technohabitsnicosia.com" target="_blank" rel="noopener">Website</a></p>
      `
    },
    cyrave: {
      icon: 'fa-people-group',
      title: 'Cyprus Rave Community',
      content: `
        <h3>About Cyprus Rave Community</h3>
        <p>Cyprus Rave Community runs <strong>C Y WE RAVE</strong>, a rave series that has moved around the island, from the Limassol district to Nicosia and Ktima Camelot.</p>

        <h3>Sound</h3>
        <p>Techno, rave and harder styles, with recurring names like MMCCCXCIX, 5KILLZ, Argy K and Morion, and a yearly August edition.</p>

        <h3>Highlights</h3>
        <ul><li>With CIDIRILK: CYWERAVE Vol.01 (August 2022)</li><li>Co-promoted two Nicosia nights with 565R (December 2022)</li><li>5 Years Anniversary (August 2026)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/111929" target="_blank" rel="noopener">Resident Advisor</a> · <a href="https://www.instagram.com/cyraveland/" target="_blank" rel="noopener">Instagram</a></p>
      `
    },
    '565r': {
      icon: 'fa-industry',
      title: '565R',
      content: `
        <h3>About 565R</h3>
        <p>565R is a collective for hard, raw, industrial techno, active in Cyprus and Greece and taking its nights abroad.</p>

        <h3>Events</h3>
        <p>It began in 2022 with <strong>CONTACT</strong> in the Alambra industrial area, and has since co-produced nights with OSTROM at Arzenal, Budapest, and MÖSARV at Ciało, Wrocław. Core artists: MMCCCXCIX and PARAPHER.</p>

        <h3>With CIDIRILK</h3>
        <ul><li>CONTACT / PODCAST (April 2022)</li><li>GENESIS (July 2022)</li></ul>

        <h3>Links</h3>
        <p><a href="https://ra.co/promoters/109788" target="_blank" rel="noopener">Resident Advisor</a> · <a href="https://www.565.network" target="_blank" rel="noopener">Website</a></p>
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

    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

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
      if (lastFocus?.isConnected) {
        try {
          lastFocus.focus({ preventScroll: true });
        } catch (e) {
          lastFocus.focus();
        }
      }
      lastFocus = null;
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

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') trapFocus(event, modal);
  });

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
      closeModal();
    }
  });
};

// DJ Guides: repository-managed guide archive.
const initDJGuides = () => {
  const section = document.querySelector('[data-guides-section]');
  if (!section) return;

  const carouselEl = section.querySelector('[data-guides-carousel]');
  const trackEl = section.querySelector('[data-guides-track]');
  const prevBtn = section.querySelector('[data-guides-prev]');
  const nextBtn = section.querySelector('[data-guides-next]');
  const dotsEl = section.querySelector('[data-guides-dots]');
  const emptyEl = section.querySelector('[data-guides-empty]');
  const emptyTitle = section.querySelector('[data-guides-empty-title]');
  const emptyCopy = section.querySelector('[data-guides-empty-copy]');
  const viewer = document.querySelector('[data-guide-viewer]');
  const viewerFrame = document.querySelector('[data-guide-viewer-frame]');
  const viewerTitle = document.querySelector('[data-guide-viewer-title]');
  const viewerOpen = document.querySelector('[data-guide-viewer-open]');
  const viewerClose = document.querySelector('[data-guide-viewer-close]');
  const viewerOverlay = document.querySelector('[data-guide-viewer-overlay]');
  const mobileGuideQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)');
  const GUIDE_DATA_URL = './data/guides.json';
  const state = {
    guides: [],
    lastFocus: null,
    fileAvailability: new Map(),
    carouselGuides: [],
    currentIndex: 0,
  };

  const createEl = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  };

  const createIcon = (className) => {
    const icon = createEl('i', className);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  };

  const normalizeText = (value) => String(value || '').trim();

  const isSafeRelativeAsset = (path, rootPath, extensions) => {
    const value = normalizeText(path).replace(/\\/g, '/');
    if (!value || value.startsWith('/') || value.includes('://') || value.includes('..')) {
      return false;
    }
    const allowedExtensions = Array.isArray(extensions) ? extensions : [extensions];
    return value.startsWith(rootPath) &&
      allowedExtensions.some((extension) => value.toLowerCase().endsWith(extension));
  };

  const getGuideFileName = (guide) => {
    const explicit = normalizeText(guide.downloadName);
    if (explicit) return explicit;
    return guide.file.split('/').pop() || `${guide.slug}.${guide.fileType.toLowerCase()}`;
  };

  const getGuideType = (file) => {
    const extension = (file.split('.').pop() || '').toUpperCase();
    return extension || 'FILE';
  };

  const getGuideLabel = (guide) => {
    const parts = [guide.fileType || 'FILE'];
    if (guide.pages) parts.push(`${guide.pages} ${guide.pages === 1 ? 'page' : 'pages'}`);
    if (guide.readingTime) parts.push(guide.readingTime);
    return parts.join(' / ');
  };

  const validateGuide = (rawGuide) => {
    if (!rawGuide || typeof rawGuide !== 'object') return null;

    const guide = {
      id: normalizeText(rawGuide.id),
      slug: normalizeText(rawGuide.slug || rawGuide.id),
      title: normalizeText(rawGuide.title),
      description: normalizeText(rawGuide.description),
      category: normalizeText(rawGuide.category),
      file: normalizeText(rawGuide.file || rawGuide.pdf),
      publishedDate: normalizeText(rawGuide.publishedDate),
      updatedDate: normalizeText(rawGuide.updatedDate),
      pages: rawGuide.pages || null,
      readingTime: normalizeText(rawGuide.readingTime),
      fileSize: normalizeText(rawGuide.fileSize),
      featured: Boolean(rawGuide.featured),
      available: rawGuide.available !== false,
      downloadName: normalizeText(rawGuide.downloadName),
    };

    if (!guide.id || !guide.slug || !guide.title || !guide.description || !guide.category) {
      return null;
    }

    guide.fileType = getGuideType(guide.file);
    guide.hasFile = isSafeRelativeAsset(
      guide.file,
      'assets/documents/',
      ['.pdf', '.png', '.jpg', '.jpeg', '.webp']
    );

    return guide;
  };

  const setEmptyState = (title, copy, visible) => {
    if (emptyTitle) emptyTitle.textContent = title;
    if (emptyCopy) emptyCopy.textContent = copy;
    emptyEl?.toggleAttribute('hidden', !visible);
  };

  const buildMeta = (guide) => {
    const meta = createEl('div', 'guide-card-meta');
    const guideLabel = getGuideLabel(guide);
    [guideLabel].filter(Boolean).forEach((item) => {
      const span = createEl('span', null, item);
      meta.appendChild(span);
    });
    return meta;
  };

  const buildActions = (guide) => {
    const actions = createEl('div', 'guide-card-actions');

    if (!guide.hasFile || !guide.available) {
      const unavailable = createEl('p', 'guide-unavailable', 'Guide not available yet.');
      actions.appendChild(unavailable);
      return actions;
    }

    const readLink = document.createElement('a');
    readLink.className = 'btn compact guide-read-link';
    readLink.href = guide.file;
    readLink.target = '_blank';
    readLink.rel = 'noopener noreferrer';
    readLink.dataset.guideRead = guide.slug;
    readLink.setAttribute('aria-label', `Read ${guide.title} online`);
    readLink.appendChild(createIcon('fa-solid fa-book-open'));
    readLink.appendChild(createEl('span', null, 'Read'));

    const downloadLink = document.createElement('a');
    downloadLink.className = 'btn compact ghost guide-download-link';
    downloadLink.href = guide.file;
    downloadLink.download = getGuideFileName(guide);
    downloadLink.dataset.guideDownload = guide.slug;
    downloadLink.setAttribute(
      'aria-label',
      `Download ${guide.title} ${guide.fileType}${guide.fileSize ? `, ${guide.fileSize}` : ''}`
    );
    downloadLink.appendChild(createIcon('fa-solid fa-file-arrow-down'));
    downloadLink.appendChild(createEl('span', null, 'Download'));

    actions.append(readLink, downloadLink);
    return actions;
  };

  const buildGuideCard = (guide, featured = false) => {
    const article = document.createElement('article');
    article.className = featured ? 'guide-card guide-card-featured' : 'guide-card';

    const body = createEl('div', 'guide-card-body');
    const category = createEl('span', 'guide-card-category', guide.category);
    const title = createEl(featured ? 'h3' : 'h4', 'guide-card-title', guide.title);
    const description = createEl('p', 'guide-card-description', guide.description);
    const titleWrap = createEl('div', 'guide-card-title-row');
    titleWrap.appendChild(title);
    body.append(category, titleWrap, description, buildMeta(guide), buildActions(guide));
    article.appendChild(body);
    return article;
  };

  const buildGuideSlide = (guide) => {
    const slide = createEl('div', 'carousel-slide guide-carousel-slide');
    slide.dataset.guideSlide = guide.slug;
    slide.appendChild(buildGuideCard(guide, guide.featured));
    return slide;
  };

  const updateCarousel = () => {
    if (!trackEl || !carouselEl || !prevBtn || !nextBtn || !dotsEl) return;
    const guides = state.carouselGuides;
    const hasGuides = guides.length > 0;
    carouselEl.toggleAttribute('hidden', !hasGuides);
    if (!hasGuides) return;

    state.currentIndex = Math.max(0, Math.min(state.currentIndex, guides.length - 1));
    if (consoleListQuery.matches) {
      setConsoleListSlides(trackEl);
      return;
    }
    trackEl.style.transform = `translateX(-${state.currentIndex * 100}%)`;

    Array.from(trackEl.children).forEach((slide, index) => {
      const isCurrent = index === state.currentIndex;
      slide.classList.toggle('is-current', isCurrent);
      slide.setAttribute('aria-hidden', String(!isCurrent));
      slide.querySelectorAll('a, button, [tabindex]').forEach((el) => {
        el.tabIndex = isCurrent ? 0 : -1;
      });
    });

    Array.from(dotsEl.children).forEach((dot, index) => {
      dot.classList.toggle('active', index === state.currentIndex);
    });

    prevBtn.disabled = guides.length <= 1 || state.currentIndex === 0;
    nextBtn.disabled = guides.length <= 1 || state.currentIndex === guides.length - 1;
  };

  const goToGuideIndex = (index) => {
    if (!state.carouselGuides.length) return;
    state.currentIndex = Math.max(0, Math.min(index, state.carouselGuides.length - 1));
    updateCarousel();
  };

  const activateGuideHash = () => {
    const hash = window.location.hash;
    if (hash !== '#dj-guides') return;
    setActiveTab('guides', false, false);
  };

  const renderGuides = () => {
    const filtered = state.guides;
    const featuredGuide = filtered.find((guide) => guide.featured);
    const carouselGuides = featuredGuide
      ? [featuredGuide, ...filtered.filter((guide) => guide.slug !== featuredGuide.slug)]
      : filtered;

    if (trackEl && dotsEl) {
      trackEl.textContent = '';
      dotsEl.textContent = '';
      state.carouselGuides = carouselGuides;
      state.currentIndex = 0;

      carouselGuides.forEach((guide, index) => {
        trackEl.appendChild(buildGuideSlide(guide));
        const dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to guide ${index + 1}: ${guide.title}`);
        dot.addEventListener('click', () => goToGuideIndex(index));
        dotsEl.appendChild(dot);
      });
      updateCarousel();
    }

    const hasVisibleGuides = Boolean(filtered.length);
    const hasAnyGuides = Boolean(state.guides.length);
    setEmptyState(
      'No guides published yet',
      hasAnyGuides
        ? 'The guide archive is ready, but no valid guide entries could be shown.'
        : 'The guide archive is ready. Add a guide file in docs/assets/documents/ and register it in docs/data/guides.json to publish the first guide.',
      !hasVisibleGuides
    );
    requestAnimationFrame(activateGuideHash);
  };

  const closeViewer = () => {
    if (!viewer || viewer.hasAttribute('hidden')) return;
    viewer.setAttribute('hidden', '');
    viewer.classList.remove('is-open');
    document.body.style.overflow = '';
    if (viewerFrame) viewerFrame.src = 'about:blank';
    if (state.lastFocus) {
      try {
        state.lastFocus.focus({ preventScroll: true });
      } catch (e) {
        state.lastFocus.focus();
      }
    }
  };

  const trapViewerFocus = (event) => {
    if (!viewer || viewer.hasAttribute('hidden') || event.key !== 'Tab') return;
    const focusable = Array.from(
      viewer.querySelectorAll('a[href], button:not([disabled]), iframe')
    ).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const openViewer = (guide, trigger) => {
    if (!viewer || !viewerFrame || !viewerTitle || !viewerOpen) return;
    state.lastFocus = trigger;
    viewerTitle.textContent = guide.title;
    viewerFrame.title = `${guide.title} guide viewer`;
    viewerFrame.src = guide.file;
    viewerOpen.href = guide.file;
    viewerOpen.setAttribute('aria-label', `Open ${guide.title} guide in a new tab`);
    viewer.classList.add('is-open');
    viewer.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => viewerClose?.focus({ preventScroll: true }), 80);
  };

  const isGuideReachable = async (guide) => {
    if (!guide.hasFile || !guide.available) return false;
    if (state.fileAvailability.has(guide.file)) {
      return state.fileAvailability.get(guide.file);
    }

    try {
      const response = await fetch(guide.file, { method: 'HEAD', cache: 'no-store' });
      const reachable = response.ok;
      state.fileAvailability.set(guide.file, reachable);
      return reachable;
    } catch (error) {
      state.fileAvailability.set(guide.file, false);
      return false;
    }
  };

  const bindGuideActions = () => {
    section.addEventListener('click', async (event) => {
      const readLink = event.target.closest('[data-guide-read]');
      if (!readLink) return;
      const guide = state.guides.find((item) => item.slug === readLink.dataset.guideRead);
      if (!guide || mobileGuideQuery.matches) return;
      event.preventDefault();
      const reachable = await isGuideReachable(guide);
      if (!reachable) {
        guide.available = false;
        renderGuides();
        return;
      }
      openViewer(guide, readLink);
    });

    section.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToGuideIndex(state.currentIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToGuideIndex(state.currentIndex + 1);
      }
    });
  };

  consoleListQuery.addEventListener('change', () => updateCarousel());

  prevBtn?.addEventListener('click', () => goToGuideIndex(state.currentIndex - 1));
  nextBtn?.addEventListener('click', () => goToGuideIndex(state.currentIndex + 1));

  let touchStartX = 0;
  carouselEl?.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  carouselEl?.addEventListener('touchend', (event) => {
    const diff = touchStartX - event.changedTouches[0].screenX;
    if (Math.abs(diff) <= 50) return;
    goToGuideIndex(state.currentIndex + (diff > 0 ? 1 : -1));
  }, { passive: true });

  const loadGuides = async () => {
    try {
      const response = await fetch(GUIDE_DATA_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Guide data returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Guide data must be an array');
      state.guides = payload.map(validateGuide).filter(Boolean);
      renderGuides();
    } catch (error) {
      state.guides = [];
      setEmptyState(
        'Guide data unavailable',
        'The guide archive could not be loaded right now. Try again later or open the guide files directly when they are published.',
        true
      );
    }
  };

  viewerClose?.addEventListener('click', closeViewer);
  viewerOverlay?.addEventListener('click', closeViewer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeViewer();
    trapViewerFocus(event);
  });
  window.addEventListener('hashchange', activateGuideHash);
  window.addEventListener('cidirilk:loadercomplete', activateGuideHash);
  window.addEventListener('cidirilk:tabchange', (event) => {
    if (event.detail?.target === 'guides') {
      requestAnimationFrame(updateCarousel);
    }
  });

  bindGuideActions();
  loadGuides();
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
// whole "Upcoming Gigs" section (Gigs then shows only Past Gigs) and move that
// event to the top of the past-gigs archive.
const checkEventExpiry = () => {
  const eventContainer = document.querySelector('[data-next-event-container]');
  const eventCard = document.querySelector('[data-event-end]');
  const showEmpty = (empty) => {
    document.querySelector('[data-panel="events"]')?.classList.toggle('gigs-none', empty);
  };

  if (!eventContainer || !eventCard) {
    showEmpty(true);
    return;
  }

  const endDate = eventCard.getAttribute('data-event-end');

  if (!endDate) return;

  const eventEndTime = new Date(endDate);
  const now = new Date();

  if (now > eventEndTime) {
    eventContainer.style.display = 'none';
    showEmpty(true);

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
    showEmpty(false);
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
    initShopCarousel();
    initShopModal();
    initCollabModal();
    initDJGuides();
    initInteractions();
  });
} else {
  checkEventExpiry();
  initCarousel();
  initCollabCarousel();
  initShopCarousel();
  initShopModal();
  initCollabModal();
  initDJGuides();
  initInteractions();
}

// Swipe parity: Sessions, SoundCloud and YouTube carousels reuse their
// prev/next buttons so dots and state stay in sync with arrow clicks.
const bindCarouselSwipe = (root, prevBtn, nextBtn) => {
  if (!root || !prevBtn || !nextBtn) return;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  root.addEventListener('touchstart', (event) => {
    if (event.target.closest('iframe')) {
      tracking = false;
      return;
    }
    const touch = event.changedTouches[0];
    startX = touch.screenX;
    startY = touch.screenY;
    tracking = true;
  }, { passive: true });

  root.addEventListener('touchend', (event) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    const dx = touch.screenX - startX;
    const dy = touch.screenY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    (dx < 0 ? nextBtn : prevBtn).click();
  }, { passive: true });
};

bindCarouselSwipe(document.querySelector('[data-livesets-carousel]'), liveSetsCarouselPrev, liveSetsCarouselNext);
bindCarouselSwipe(document.querySelector('[data-podcast-carousel]'), podcastCarouselPrev, podcastCarouselNext);
bindCarouselSwipe(document.querySelector('[data-youtube-carousel]'), youtubeCarouselPrev, youtubeCarouselNext);

// Radio popup "Sessions" buttons go to the Sessions section on this page:
// desktop opens the Sessions tab and collapses the radio popup; phones close
// the radio popover and follow the #sessions anchor.
document.querySelectorAll('[data-live-sessions-link]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (window.matchMedia('(min-width: 1025px)').matches) {
      const sessionsTab = document.querySelector('.card-tabs .tab-button[data-tab="sessions"]');
      if (!sessionsTab) return;
      event.preventDefault();
      sessionsTab.click();
      sessionsTab.focus({ preventScroll: true });
      collapseDesktopRadioPopup();
      return;
    }
    closeMobileRadioPopover();
  });
});

// Hero "Listen to sessions": on the desktop console open the Sessions tab;
// on smaller screens the #sessions anchor scrolls to the section as usual.
document.querySelector('[data-hero-listen]')?.addEventListener('click', (event) => {
  if (!window.matchMedia('(min-width: 1025px)').matches) return;
  const sessionsTab = document.querySelector('.card-tabs .tab-button[data-tab="sessions"]');
  if (!sessionsTab) return;
  event.preventDefault();
  sessionsTab.click();
  sessionsTab.focus({ preventScroll: true });
});

// "Join the Signal" prompts (Sessions, Gigs, Artifacts; each under its section
// description, above the content): send the visitor to
// the one newsletter form instead of duplicating it. Desktop console: open
// the Signal tab; smaller screens: scroll to the section. Then focus the email
// field. Without JS the #signal anchor still scrolls to the form.
document.querySelectorAll('[data-signal-open]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const panel = document.querySelector('[data-panel="subscribe"]');
    const email = panel?.querySelector('input[type="email"]');
    if (!panel) return;
    event.preventDefault();
    if (window.matchMedia('(min-width: 1025px)').matches) {
      const tab = document.querySelector('.card-tabs .tab-button[data-tab="subscribe"]');
      tab?.click();
      setTimeout(() => email?.focus({ preventScroll: true }), 120);
    } else {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => email?.focus({ preventScroll: true }), reduced ? 0 : 450);
    }
  });
});

// Clicking the Signal tab itself (mouse/touch, desktop console) also puts the
// cursor in the email field. Keyboard tab navigation keeps focus on the tabs.
document.querySelector('.card-tabs .tab-button[data-tab="subscribe"]')?.addEventListener('click', (event) => {
  if (!event.detail || !consoleListQuery.matches) return;
  const email = document.querySelector('[data-panel="subscribe"] input[type="email"]');
  setTimeout(() => email?.focus({ preventScroll: true }), 120);
});

// ChaCha hybrid sets (SoundCloud tab, under Your Monthly Dose): the same card
// player and carousel as Monthly Dose (artwork tile, own controls over a
// hidden SoundCloud widget, prev/next, dots, swipe), fed with the 10 newest
// tracks of the ChaCha playlist, read live through a hidden source widget.
(() => {
  const source = document.querySelector('[data-chacha-source]');
  const list = document.querySelector('[data-chacha-episodes]');
  const carousel = document.querySelector('[data-chacha-carousel]');
  const prevBtn = document.querySelector('[data-chacha-prev]');
  const nextBtn = document.querySelector('[data-chacha-next]');
  const dots = document.querySelector('[data-chacha-dots]');
  if (!source || !list) return;
  const LIMIT = MEDIA_CAROUSEL_LIMIT;
  const PLAYLIST = 'https://soundcloud.com/cc_grooves_00357/sets/chacha';
  let started = false;
  let count = 0;

  const cleanTitle = (title) => {
    let name = String(title || '').replace(/\s*-\s*hybrid set.*$/i, '').trim();
    name = /^chacha\s*@\s*/i.test(name) ? name.replace(/^chacha\s*@\s*/i, '') : name.replace(/^chacha\s+/i, '');
    return name || 'Hybrid set';
  };
  const formatDate = (value) => {
    const date = new Date(value);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number.isNaN(date.getTime()) ? '' : `${months[date.getMonth()]} ${date.getFullYear()}`;
  };
  // Real cards only: the wrap-around clones keep data-chacha-track
  const cards = () => [...list.querySelectorAll('.podcast-episode[data-chacha-track]:not([data-podcast-clone])')];
  const activeIndex = () => {
    const index = cards().findIndex((card) => card.getAttribute('aria-current') === 'true');
    return index < 0 ? 0 : index;
  };

  const status = (message, loading = false) => {
    list.style.transform = '';
    const box = document.createElement('span');
    box.className = `podcast-episodes-status${loading ? ' is-loading' : ''}`;
    if (loading) {
      const spinner = document.createElement('span');
      spinner.className = 'podcast-loading-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      box.appendChild(spinner);
    }
    const text = document.createElement('span');
    text.textContent = message;
    box.appendChild(text);
    list.replaceChildren(box);
  };

  const renderDots = (active) => {
    if (!dots) return;
    dots.replaceChildren(...Array.from({ length: count }, (_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `carousel-dot${index === active ? ' active' : ''}`;
      dot.setAttribute('aria-current', index === active ? 'true' : 'false');
      dot.setAttribute('aria-label', `Go to ChaCha set ${index + 1}`);
      dot.addEventListener('click', () => setActive(index));
      return dot;
    }));
  };

  const setActive = (index, options = {}) => {
    renderDots(index);
    cards().forEach((card, i) => {
      const active = i === index;
      card.classList.toggle('active', active);
      card.setAttribute('aria-current', active ? 'true' : 'false');
      card.tabIndex = active ? 0 : -1;
      setCardDescendantFocusability(card, active);
      if (active) {
        loadPodcastCardPlayer(card);
        setPeekCarouselPosition(list, card.closest('.podcast-slide'), Boolean(options.instant), options.wrapDirection);
      } else {
        unloadPodcastCardPlayer(card);
      }
    });
  };

  const move = (direction) => {
    if (!count) return;
    const current = activeIndex();
    const next = (current + direction + count) % count;
    const wraps = (direction < 0 && current === 0) || (direction > 0 && current === count - 1);
    setActive(next, { wrapDirection: wraps ? direction : 0 });
  };

  // Newest sets first, trimmed to what the cards need (so they cache compactly)
  const pickNewest = (sounds) => sounds
    .filter((sound) => sound && sound.title)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, LIMIT)
    .map(({ id, permalink_url, title, artwork_url, created_at, display_date }) =>
      ({ id, permalink_url, title, artwork_url, created_at, display_date }));

  // Like Monthly Dose: the last list is kept for 7 days so repeat visits show
  // the cards instantly; SoundCloud is asked again in the background.
  const CACHE_KEY = 'cidirilkChachaTracks';
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  const signature = (sets) => sets.map((set) => `${set.id}:${set.title}`).join('|');
  const readCache = () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.playlist === PLAYLIST && Array.isArray(cached.sets) && cached.sets.length &&
        Date.now() - cached.cachedAt < CACHE_TTL) return cached.sets;
    } catch (e) {}
    return null;
  };
  const writeCache = (sets) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ playlist: PLAYLIST, sets, cachedAt: Date.now() }));
    } catch (e) {}
  };

  const render = (newest) => {
    count = newest.length;
    if (!count) {
      status('ChaCha sets are not available right now.');
      return;
    }
    list.replaceChildren();
    newest.forEach((sound, index) => {
      const name = cleanTitle(sound.title);
      const label = `#${String(count - index).padStart(2, '0')}`;
      const slide = document.createElement('div');
      slide.className = 'podcast-slide';
      const card = document.createElement('article');
      card.className = 'podcast-episode';
      card.dataset.chachaTrack = String(index);
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `ChaCha ${name}`);
      card.setAttribute('aria-current', 'false');
      card.tabIndex = -1;
      setCardDescendantFocusability(card, false);
      const artwork = normalizeSoundCloudArtworkUrl(sound.artwork_url);
      if (artwork) {
        card.classList.add('has-artwork');
        card.style.setProperty('--podcast-artwork', `url("${artwork}")`);
      }

      const player = document.createElement('span');
      player.className = 'podcast-episode-player is-unloaded';
      player.dataset.soundcloudCardPlayer = '';
      const trackUrl = getSoundCloudTrackUrl(sound);
      if (trackUrl) {
        const iframe = document.createElement('iframe');
        iframe.className = 'podcast-card-frame';
        iframe.title = `${name} SoundCloud preview`;
        iframe.loading = 'eager';
        iframe.scrolling = 'no';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.dataset.soundcloudCardFrame = '';
        iframe.dataset.soundcloudSrc = buildSoundCloudPlayerSrc(trackUrl, 0, false);
        preparePodcastCardFrame(card, player, iframe);
        player.appendChild(iframe);
      }

      const meta = document.createElement('span');
      meta.className = 'podcast-episode-meta';
      const number = document.createElement('span');
      number.className = 'podcast-episode-number';
      number.textContent = label;
      meta.appendChild(number);

      const kicker = ['Hybrid set', formatDate(sound.display_date || sound.created_at)].filter(Boolean).join(' · ');
      card.append(meta, player, createPodcastControls(sound, { label: name, kicker, title: name, onStep: move }));
      slide.appendChild(card);
      list.appendChild(slide);
    });
    addPodcastCarouselClones(list);
    setActive(0, { instant: true });
  };

  const start = () => {
    if (started) return;
    started = true;
    const cached = readCache();
    if (cached) {
      render(cached);
      // Revalidate once the visible card has had a head start on the network
      setTimeout(() => fetchSets(cached), 3000);
      return;
    }
    status('Getting signals from SoundCloud...', true);
    fetchSets(null);
  };

  const fetchSets = (cached) => {
    if (!window.SC?.Widget) {
      setTimeout(() => fetchSets(cached), 500);
      return;
    }
    source.src = buildSoundCloudPlayerSrc(source.dataset.soundcloudUrl || PLAYLIST, 0, false);
    const widget = window.SC.Widget(source);
    let tries = 0;
    let done = false;
    const load = () => {
      widget.getSounds((sounds) => {
        const complete = Array.isArray(sounds) && sounds.length && sounds.every((sound) => sound?.title);
        if (complete || tries >= 6) {
          done = true;
          source.removeAttribute('src');
          const sets = pickNewest(Array.isArray(sounds) ? sounds : []);
          if (!sets.length) {
            if (!cached) status('ChaCha sets are not available right now.');
            return;
          }
          writeCache(sets);
          // Skip the redraw when nothing changed or a set is playing
          if (cached && (signature(cached) === signature(sets) || list.querySelector('.is-playing-episode'))) return;
          render(sets);
        } else {
          tries += 1;
          setTimeout(load, 700);
        }
      });
    };
    widget.bind(window.SC.Widget.Events.READY, load);
    if (!cached) setTimeout(() => { if (!done) status('Still connecting to SoundCloud...'); }, 8000);
  };

  prevBtn?.addEventListener('click', () => move(-1));
  nextBtn?.addEventListener('click', () => move(1));
  bindCarouselSwipe(carousel, prevBtn, nextBtn);

  // The active card's widget loads only while it is visible
  const loadVisible = () => {
    const card = list.querySelector('.podcast-episode.active[data-chacha-track]:not([data-podcast-clone])');
    if (card) loadPodcastCardPlayer(card);
  };
  window.addEventListener('cidirilk:tabchange', loadVisible);
  window.addEventListener('resize', loadVisible, { passive: true });

  // Load once the SoundCloud panel is on screen (desktop tab shown, or the
  // section scrolled near on phones)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { rootMargin: '200px' });
    observer.observe(list.closest('.tab-panel') || list);
  } else {
    start();
  }
})();

// Any audio starting (a LiveSets session or the live radio) pauses the other
// audio, every SoundCloud card and YouTube video
document.addEventListener('play', (event) => {
  if (!(event.target instanceof HTMLMediaElement)) return;
  document.querySelectorAll('audio').forEach((audio) => {
    if (audio !== event.target && !audio.paused) audio.pause();
  });
  document.querySelectorAll('.podcast-episode').forEach((card) => card._podcastWidget?.pause());
  pauseYoutubePlayers();
}, true);

// Bookings dialog: the hero "Bookings" link opens it (without JS it stays a
// plain mailto link). Native <dialog> handles focus, Escape and the backdrop.
(() => {
  const dialog = document.querySelector('[data-booking-dialog]');
  const openers = document.querySelectorAll('[data-booking-open]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const copyBtn = dialog.querySelector('[data-booking-copy]');
  const copyLabel = dialog.querySelector('[data-booking-copy-label]');
  const status = dialog.querySelector('[data-booking-status]');
  const address = dialog.querySelector('.booking-address');
  let resetTimer;

  openers.forEach((opener) => {
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      if (status) status.textContent = '';
      dialog.showModal();
    });
  });

  // Clicking the backdrop (outside the panel) closes the dialog
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });

  const showCopied = (message) => {
    if (copyLabel) copyLabel.textContent = 'Copied';
    if (status) status.textContent = message;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      if (copyLabel) copyLabel.textContent = 'Copy';
    }, 2000);
  };

  copyBtn?.addEventListener('click', async () => {
    const email = address?.dataset.bookingEmail || address?.textContent.trim() || '';
    try {
      await navigator.clipboard.writeText(email);
      showCopied('Email copied to clipboard.');
    } catch {
      // Clipboard API unavailable: select the address so it can be copied manually
      const range = document.createRange();
      range.selectNodeContents(address);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (status) status.textContent = 'Press Ctrl+C (or ⌘C) to copy the selected email.';
    }
  });
})();

// Your Monthly Dose: our own player UI (mockup) on top of the SoundCloud
// widget, which stays loaded but visually hidden and keeps streaming the
// audio. Controls talk to it through the SoundCloud Widget API.
function formatPodcastTime(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// opts (all optional) let another SoundCloud carousel reuse the same card
// player: label, kicker, title, and onStep(direction) for prev/next.
function createPodcastControls(track, opts = {}) {
  const label = opts.label || formatPodcastEpisodeLabel(track);
  const kicker = opts.kicker || `SoundCloud · ${label}`;
  const title = opts.title || formatPodcastEpisodeTitle();
  const onStep = opts.onStep || movePodcastCarousel;
  const ui = document.createElement('div');
  ui.className = 'podcast-ui';
  ui.innerHTML = `
    <span class="podcast-ui-kicker"></span>
    <strong class="podcast-ui-title"></strong>
    <span class="podcast-ui-progress" role="slider" tabindex="0" aria-label="Seek"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-podcast-seek>
      <span class="podcast-ui-fill"></span>
    </span>
    <span class="podcast-ui-bottom">
      <span class="podcast-ui-time" data-podcast-time>0:00</span>
      <span class="podcast-ui-buttons">
        <button type="button" class="podcast-ui-btn" data-podcast-step="-1" aria-label="Previous episode">
          <i class="fa-solid fa-backward-step" aria-hidden="true"></i></button>
        <button type="button" class="podcast-ui-btn podcast-ui-play" data-podcast-toggle aria-label="Play">
          <i class="fa-solid fa-play" aria-hidden="true"></i><i class="fa-solid fa-pause" aria-hidden="true"></i></button>
        <button type="button" class="podcast-ui-btn" data-podcast-step="1" aria-label="Next episode">
          <i class="fa-solid fa-forward-step" aria-hidden="true"></i></button>
      </span>
    </span>`;
  // Text set via textContent: titles come from SoundCloud
  ui.querySelector('.podcast-ui-kicker').textContent = kicker;
  ui.querySelector('.podcast-ui-title').textContent = title;
  ui.querySelector('[data-podcast-seek]').setAttribute('aria-label', `Seek ${label}`);
  ui.querySelector('[data-podcast-toggle]').setAttribute('aria-label', `Play ${label}`);

  ui.querySelector('[data-podcast-toggle]').addEventListener('click', (event) => {
    event.stopPropagation();
    const card = ui.closest('.podcast-episode');
    const widget = card?._podcastWidget;
    if (widget && card.dataset.widgetReady === 'true') {
      widget.toggle();
    } else if (card) {
      card.dataset.playWhenReady = 'true';
      loadPodcastCardPlayer(card);
    }
  });

  ui.querySelectorAll('[data-podcast-step]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onStep(Number(button.dataset.podcastStep));
    });
  });

  const seek = ui.querySelector('[data-podcast-seek]');
  const seekTo = (ratio) => {
    const card = ui.closest('.podcast-episode');
    const widget = card?._podcastWidget;
    const duration = Number(card?.dataset.durationMs || 0);
    if (!widget || !duration) return;
    widget.seekTo(Math.max(0, Math.min(1, ratio)) * duration);
  };
  seek.addEventListener('click', (event) => {
    event.stopPropagation();
    const rect = seek.getBoundingClientRect();
    seekTo((event.clientX - rect.left) / rect.width);
  });
  seek.addEventListener('keydown', (event) => {
    const card = ui.closest('.podcast-episode');
    const duration = Number(card?.dataset.durationMs || 0);
    if (!duration || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const now = Number(card.dataset.positionMs || 0);
    seekTo((now + (event.key === 'ArrowRight' ? 15000 : -15000)) / duration);
  });
  return ui;
}

function updatePodcastControls(card, positionMs) {
  const duration = Number(card.dataset.durationMs || 0);
  const position = Math.max(0, Number(positionMs) || 0);
  card.dataset.positionMs = String(position);
  const ratio = duration ? Math.min(1, position / duration) : 0;
  card.style.setProperty('--podcast-progress', `${(ratio * 100).toFixed(2)}%`);
  card.querySelector('[data-podcast-seek]')?.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  const time = card.querySelector('[data-podcast-time]');
  if (time) {
    const text = duration ? `${formatPodcastTime(position)} / ${formatPodcastTime(duration)}` : formatPodcastTime(position);
    if (time.textContent !== text) time.textContent = text;
  }
}

function setPodcastPlaying(card, playing) {
  card.classList.toggle('is-playing-episode', playing);
  const toggle = card.querySelector('[data-podcast-toggle]');
  const label = card.querySelector('.podcast-episode-number')?.textContent || 'episode';
  toggle?.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${label}`);
}

function resetPodcastControls(card) {
  delete card._podcastWidget;
  delete card._podcastWidgetFrame;
  card.dataset.widgetReady = 'false';
  setPodcastPlaying(card, false);
  updatePodcastControls(card, 0);
}

function bindPodcastWidget(card) {
  const iframe = card.querySelector('[data-soundcloud-card-frame]');
  const src = iframe?.getAttribute('src');
  if (!iframe || !src || src === 'about:blank' || !window.SC?.Widget) return;
  if (card._podcastWidget && card._podcastWidgetFrame === iframe) return;
  const widget = window.SC.Widget(iframe);
  card._podcastWidget = widget;
  card._podcastWidgetFrame = iframe;
  const { Events } = window.SC.Widget;
  const isCurrentFrame = () =>
    iframe.isConnected && card.querySelector('[data-soundcloud-card-frame]') === iframe;

  widget.bind(Events.READY, () => {
    if (!isCurrentFrame()) return;
    card.dataset.widgetReady = 'true';
    widget.getDuration((duration) => {
      if (!isCurrentFrame()) return;
      card.dataset.durationMs = String(duration || 0);
      updatePodcastControls(card, 0);
    });
    if (card.dataset.playWhenReady === 'true') {
      delete card.dataset.playWhenReady;
      widget.play();
    }
  });
  widget.bind(Events.PLAY, () => {
    if (!isCurrentFrame()) return;
    setPodcastPlaying(card, true);
    // One player at a time: pause the other SoundCloud cards and any audio
    document.querySelectorAll('.podcast-episode').forEach((other) => {
      if (other !== card) other._podcastWidget?.pause();
    });
    document.querySelectorAll('audio').forEach((audio) => { if (!audio.paused) audio.pause(); });
    pauseYoutubePlayers();
  });
  widget.bind(Events.PAUSE, () => {
    if (isCurrentFrame()) setPodcastPlaying(card, false);
  });
  widget.bind(Events.FINISH, () => {
    if (isCurrentFrame()) setPodcastPlaying(card, false);
  });
  widget.bind(Events.PLAY_PROGRESS, (event) => {
    if (isCurrentFrame()) updatePodcastControls(card, event?.currentPosition);
  });
  widget.bind(Events.SEEK, (event) => {
    if (isCurrentFrame()) updatePodcastControls(card, event?.currentPosition);
  });
}

// Leaving the YouTube tab on the desktop console stops the playing video
// (an embedded player otherwise keeps playing in the hidden panel).
window.addEventListener('cidirilk:tabchange', (event) => {
  if (event.detail?.target === 'youtube') return;
  getYoutubeCards().forEach((card) => unloadYoutubeCardPlayer(card));
});

// Generated YouTube covers: a deterministic, theme-aware SVG per video
// (gradient, glow, planet-ring orbit, waveform strip, title). Colours come
// from CSS custom properties, so the same art renders for dark and light.
function createYoutubePreview(video, index) {
  let seed = [...String(video.id)].reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const uid = `yt${index}`;
  const glowX = Math.round(70 + rand() * 180);
  const glowY = Math.round(40 + rand() * 60);
  const ringTilt = Math.round(-14 + rand() * 28);
  const ringRx = Math.round(118 + rand() * 40);
  const bars = Array.from({ length: 56 }, (_, i) => {
    const h = 4 + Math.round(Math.abs(Math.sin(i * 0.55 + rand() * 1.4) * Math.cos(i * 0.18 + index)) * 30 + rand() * 6);
    const x = 24 + i * 4.9;
    return `<rect x="${x.toFixed(1)}" y="${(118 - h / 2).toFixed(1)}" width="2.6" height="${h}" rx="1.3" style="opacity:${(0.35 + rand() * 0.6).toFixed(2)}"/>`;
  }).join('');
  const name = String(video.title || '').replace(/^cidirilk_/i, '').replace(/_/g, ' ').trim() || 'Untitled';
  const label = `CIDIRILK · VIDEO ${String(index + 1).padStart(2, '0')}`;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const art = document.createElement('span');
  art.className = 'youtube-card-art';
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = `
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color:var(--yt-bg-a)"/>
          <stop offset="1" style="stop-color:var(--yt-bg-b)"/>
        </linearGradient>
        <radialGradient id="${uid}-glow" cx="${glowX}" cy="${glowY}" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" style="stop-color:var(--yt-glow);stop-opacity:var(--yt-glow-a)"/>
          <stop offset="1" style="stop-color:var(--yt-glow);stop-opacity:0"/>
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#${uid}-bg)"/>
      <rect width="320" height="180" fill="url(#${uid}-glow)"/>
      <g transform="rotate(${ringTilt} 160 92)" fill="none" style="stroke:var(--yt-line)">
        <ellipse cx="160" cy="92" rx="${ringRx}" ry="30" stroke-width="1.2"/>
        <ellipse cx="160" cy="92" rx="${ringRx + 18}" ry="40" stroke-width="0.8" stroke-dasharray="2 5" style="opacity:.6"/>
      </g>
      <g style="fill:var(--yt-line)">${bars}</g>
      <text x="296" y="26" text-anchor="end" style="fill:var(--yt-muted);font:500 8px var(--font-mono);letter-spacing:.18em">${esc(label)}</text>
      <text x="22" y="160" style="fill:var(--yt-text);font:600 22px var(--font-body);letter-spacing:-.02em">${esc(name)}</text>
    </svg>`;
  return art;
}

// Artifacts on the desktop console: one featured product (large art, full
// copy, payment buttons) + the others as compact tiles. Clicking a tile
// features it; the featured product's image still opens the zoom modal.
(() => {
  const track = document.querySelector('[data-panel="shop"] [data-shop-track]');
  if (!track) return;
  const realSlides = () => [...track.querySelectorAll('.shop-slide')].filter(
    (slide) => !slide.classList.contains('is-carousel-clone') && slide.dataset.carouselClone !== 'true',
  );

  const feature = (target) => {
    const slides = realSlides();
    slides.forEach((slide, index) => {
      const featured = slide === target;
      slide.classList.toggle('is-featured', featured);
      slide.style.setProperty('--shop-index', `'${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}'`);
      const item = slide.querySelector('.shop-item');
      if (!item) return;
      const imageButton = item.querySelector('.shop-image-button');
      const name = item.querySelector('h4')?.textContent.trim() || 'artifact';
      const previewLabel = imageButton?.dataset.previewLabel
        || imageButton?.getAttribute('aria-label')
        || `View ${name} full size`;
      if (imageButton) imageButton.dataset.previewLabel = previewLabel;
      if (featured) {
        item.removeAttribute('role');
        item.removeAttribute('tabindex');
        item.removeAttribute('aria-label');
        imageButton?.setAttribute('aria-label', previewLabel);
      } else {
        // The image button remains the only keyboard target. A focusable card
        // around it would create nested interactive controls.
        item.removeAttribute('role');
        item.removeAttribute('tabindex');
        item.removeAttribute('aria-label');
        imageButton?.setAttribute('aria-label', `Show ${name}`);
      }
    });
  };

  // Each frame takes the colour of its product shot's side edges, so the
  // letterbox around the photo reads as part of the photo in both themes
  const sampleEdge = (img) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 32;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 96, 32);
      const { data } = ctx.getImageData(0, 0, 96, 32);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 0; y < 32; y += 1) {
        for (const x of [0, 95]) {
          const i = (y * 96 + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
        }
      }
      return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
    } catch {
      return '';
    }
  };
  track.querySelectorAll('.shop-image-button').forEach((button) => {
    const img = button.querySelector('img');
    if (!img) return;
    const apply = () => {
      const colour = sampleEdge(img);
      if (colour) button.style.setProperty('--shop-art-bg', colour);
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  });

  feature(realSlides()[0]);

  const pick = (event) => {
    if (!consoleListQuery.matches) return;
    const slide = event.target.closest('.shop-slide');
    if (!slide || slide.classList.contains('is-featured') || !realSlides().includes(slide)) return;
    // Selecting a tile must not also open the image zoom
    event.preventDefault();
    event.stopPropagation();
    feature(slide);
    slide.querySelector('.shop-image-button')?.focus({ preventScroll: true });
  };
  track.addEventListener('click', pick, true);
  track.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') pick(event);
  }, true);
})();
