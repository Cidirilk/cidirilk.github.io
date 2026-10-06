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
  if (!tabButtons.length || !tabPanels.length) return;

  if (tabMobileQuery.matches) {
    showMobileTabSections();
    return;
  }

  const current =
    [...tabButtons].find((button) => button.classList.contains('active'))?.getAttribute('data-tab') ||
    getCookie(TAB_COOKIE) ||
    'subscribe';
  const hasPanel = [...tabPanels].some((panel) => panel.getAttribute('data-panel') === current);
  setActiveTab(hasPanel ? current : 'subscribe', false);
};

if (tabButtons.length && tabPanels.length) {
  const saved = getCookie(TAB_COOKIE);
  const hashTab = shouldPreserveInitialHash ? 'guides' : '';
  const defaultTab =
    hashTab ||
    (saved && [...tabPanels].some((panel) => panel.getAttribute('data-panel') === saved) ? saved : 'subscribe');
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

const buildSoundCloudPlayerSrc = (sourceUrl, trackIndex = 0, usePlaylistIndex = true) => {
  const theme = root.getAttribute('data-theme') || 'dark';
  const params = new URLSearchParams({
    url: sourceUrl,
    color: theme === 'light' ? '#9b45ff' : '#c174ff',
    auto_play: 'false',
    hide_related: 'false',
    show_comments: 'false',
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

const loadPodcastCardPlayer = (card) => {
  const player = card?.querySelector('[data-soundcloud-card-player]');
  const iframe = card?.querySelector('[data-soundcloud-card-frame]');
  if (!iframe) return;
  if (iframe.getAttribute('src')) {
    finishPodcastPreviewLoad(player);
    return;
  }
  const src = iframe.dataset.soundcloudSrc;
  if (src) {
    player?.classList.remove('is-unloaded', 'is-preview-ready');
    player?.classList.add('is-loading-preview');
    if (player) player.dataset.previewStartedAt = String(Date.now());
    iframe.setAttribute('src', src);
    setTimeout(() => finishPodcastPreviewLoad(player), 2600);
  }
};

const unloadPodcastCardPlayer = (card) => {
  const player = card?.querySelector('[data-soundcloud-card-player]');
  const iframe = card?.querySelector('[data-soundcloud-card-frame]');
  if (!iframe?.getAttribute('src')) return;
  iframe.removeAttribute('src');
  player?.classList.remove('is-loading-preview', 'is-preview-ready');
  player?.classList.add('is-unloaded');
  if (player) delete player.dataset.previewStartedAt;
};

const setPeekCarouselPosition = (track, slide, instant = false) => {
  if (!track || !slide) return;
  const targetLeft = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
  const disableAnimation = instant || tabReducedMotion;
  if (disableAnimation) {
    track.style.transition = 'none';
  }
  track.style.transform = `translateX(-${targetLeft}px)`;
  if (disableAnimation) {
    void track.offsetHeight;
    track.style.transition = '';
  }
};

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
      if (active) {
        loadPodcastCardPlayer(card);
      } else {
        unloadPodcastCardPlayer(card);
      }
      if (active) {
        if (options.instant && card) {
          setPeekCarouselPosition(list, card.closest('.podcast-slide'), true);
        } else {
          setPeekCarouselPosition(list, card.closest('.podcast-slide'));
        }
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
  setActiveSoundCloudTrack(nextIndex, { instant: wrapsAround });
};

const formatPodcastEpisodeLabel = (track, index) => {
  const title = String(track?.title || '').trim();
  const episodeMatch = title.match(/#\s*(\d+)/);
  if (episodeMatch) return `#${episodeMatch[1].padStart(3, '0')}`;
  return `#${String(index + 1).padStart(3, '0')}`;
};

const formatPodcastEpisodeTitle = () => {
  return 'Your Monthly Dose';
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
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(playlistUrl)}`
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
  clone.classList.remove('active');
  clone.dataset.podcastClone = 'true';
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('.podcast-episode').forEach((card) => {
    card.classList.remove('active');
    card.dataset.podcastClone = 'true';
    card.removeAttribute('data-soundcloud-track');
    card.removeAttribute('data-soundcloud-url');
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

const renderSoundCloudEpisodes = (tracks, playlistArtworkUrl = '') => {
  if (!soundCloudEpisodeLists.length || !tracks?.length) return;
  const selectedIndex = Number.parseInt(soundCloudSourcePlayers[0]?.dataset.soundcloudTrackIndex || '0', 10);
  const startIndex = Math.max(0, tracks.length - MEDIA_CAROUSEL_LIMIT);
  const visibleTracks = tracks.slice(startIndex).map((track, index) => ({
    ...track,
    trackIndex: Number.isInteger(track?.trackIndex) ? track.trackIndex : startIndex + index,
  }));
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
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-current', active ? 'true' : 'false');
      if (playlistArtwork) {
        card.classList.add('has-artwork');
        card.style.setProperty('--podcast-artwork', `url("${playlistArtwork}")`);
      }

      const trackUrl = String(track?.permalink_url || '').trim();
      const playerUrl = trackUrl || playlistUrl;
      if (playerUrl) {
        card.dataset.soundcloudUrl = playerUrl;
        card.setAttribute(
          'aria-label',
          `Open ${formatPodcastEpisodeTitle(track, index)} ${formatPodcastEpisodeLabel(track, index)} on SoundCloud`
        );
      }
      const playerIndex = Number.isInteger(track?.trackIndex) ? track.trackIndex : index;
      const player = document.createElement('span');
      player.className = `podcast-episode-player${active ? ' is-loading-preview' : ' is-unloaded'}`;
      player.dataset.soundcloudCardPlayer = '';
      if (active) player.dataset.previewStartedAt = String(Date.now());
      if (playerUrl) {
        const iframe = document.createElement('iframe');
        iframe.className = 'podcast-card-frame';
        iframe.title = `${formatPodcastEpisodeLabel(track, index)} SoundCloud preview`;
        iframe.loading = 'lazy';
        iframe.scrolling = 'no';
        iframe.allow = 'autoplay';
        iframe.dataset.soundcloudCardFrame = '';
        iframe.dataset.soundcloudSrc = buildSoundCloudPlayerSrc(playerUrl, playerIndex, !trackUrl);
        iframe.addEventListener('load', () => finishPodcastPreviewLoad(player), { once: true });
        if (active) {
          iframe.src = iframe.dataset.soundcloudSrc;
          setTimeout(() => finishPodcastPreviewLoad(player), 2600);
        }
        player.appendChild(iframe);
      }

      const meta = document.createElement('span');
      meta.className = 'podcast-episode-meta';
      const number = document.createElement('span');
      number.className = 'podcast-episode-number';
      number.textContent = formatPodcastEpisodeLabel(track, index);
      meta.appendChild(number);
      card.append(meta, player);
      slide.appendChild(card);
      list.appendChild(slide);
    });
    addPodcastCarouselClones(list);
  });
  renderPodcastCarouselDots(visibleTracks.length);
  setActiveSoundCloudTrack(activeIndex, { instant: true });
};

soundCloudEpisodeLists.forEach((list) => {
  list.addEventListener('click', (event) => {
    const card = event.target.closest('.podcast-episode[data-soundcloud-url]');
    if (!card) return;
    window.open(card.dataset.soundcloudUrl, '_blank', 'noopener,noreferrer');
  });

  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const card = event.target.closest('.podcast-episode[data-soundcloud-url]');
    if (!card) return;
    event.preventDefault();
    window.open(card.dataset.soundcloudUrl, '_blank', 'noopener,noreferrer');
  });
});

podcastCarouselPrev?.addEventListener('click', () => movePodcastCarousel(-1));
podcastCarouselNext?.addEventListener('click', () => movePodcastCarousel(1));

const initSoundCloudEpisodeLists = () => {
  if (!soundCloudSourcePlayers.length || !soundCloudEpisodeLists.length) return;
  renderSoundCloudEpisodeStatus('Getting signals from SoundCloud...', true);
  loadSoundCloudSourcePlayers();
  if (!window.SC?.Widget) {
    renderSoundCloudEpisodeStatus('SoundCloud player could not load. Please refresh in a moment.');
    return;
  }

  let rendered = false;
  const widget = window.SC.Widget(soundCloudSourcePlayers[0]);
  widget.bind(window.SC.Widget.Events.READY, () => {
    if (typeof widget.getSounds !== 'function') return;
    widget.getSounds(async (tracks) => {
      if (Array.isArray(tracks) && tracks.length) {
        rendered = true;
        const playlistUrl = String(soundCloudSourcePlayers[0]?.dataset.soundcloudUrl || '').trim();
        const playlistArtworkUrl = await fetchPodcastPlaylistArtwork(playlistUrl);
        renderSoundCloudEpisodes(tracks, playlistArtworkUrl);
        releaseSoundCloudSourcePlayers();
      }
    });
  });

  setTimeout(() => {
    if (!rendered) renderSoundCloudEpisodeStatus('Still connecting to SoundCloud...');
  }, 4000);
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

const fetchLiveSetsSessionMeta = async (sessionId) => {
  if (!sessionId) return null;
  if (liveSetsSessionMetaCache.has(sessionId)) return liveSetsSessionMetaCache.get(sessionId);

  for (const strategy of buildLiveSetsSessionMetaStrategies(sessionId)) {
    try {
      const response = await fetch(strategy.url, {
        headers: { Accept: strategy.name === 'worker' ? 'application/json' : 'text/html, application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`${strategy.name} status ${response.status}`);
      const meta = await strategy.extract(response);
      if (meta?.urlAudio?.length) {
        liveSetsSessionMetaCache.set(sessionId, meta);
        return meta;
      }
    } catch (error) {
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
  embedUrl: `https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1&playsinline=1`,
  autoplayUrl: `https://www.youtube.com/embed/${video.id}?rel=0&modestbranding=1&playsinline=1&autoplay=1`,
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
  frame.src = autoplay ? frame.dataset.youtubeAutoplaySrc || '' : frame.dataset.youtubeSrc || '';
  player?.classList.add('is-loaded');
};

const unloadYoutubeCardPlayer = (card) => {
  const frame = card?.querySelector('[data-youtube-frame]');
  const player = card?.querySelector('[data-youtube-player]');
  if (!frame) return;
  frame.removeAttribute('src');
  player?.classList.remove('is-loaded');
};

const setActiveYoutubeVideo = (videoIndex, options = {}) => {
  renderYoutubeCarouselDots(youtubeVideoCount, videoIndex);
  youtubeVideoLists.forEach((list) => {
    list.querySelectorAll('.youtube-card[data-youtube-video]').forEach((card) => {
      const active = Number.parseInt(card.dataset.youtubeVideo || '0', 10) === videoIndex;
      card.classList.toggle('active', active);
      card.setAttribute('aria-current', active ? 'true' : 'false');
      card.tabIndex = active ? 0 : -1;
      if (active) {
        setPeekCarouselPosition(list, card.closest('.youtube-slide'), Boolean(options.instant));
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
      card.tabIndex = active ? 0 : -1;
      if (!active) {
        pauseLiveSetsCardPlayer(card);
        return;
      }

      if (options.instant) {
        setPeekCarouselPosition(list, card.closest('.sessions-slide'), true);
      } else {
        setPeekCarouselPosition(list, card.closest('.sessions-slide'));
      }
    });
  });
};

const pauseLiveSetsCardPlayer = (card) => {
  const audio = card?.querySelector('[data-livesets-audio]');
  if (!audio) return;
  audio.pause();
  card.classList.remove('is-playing-session');
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
  setLiveSetsCardPlayerState(card, 'is-loading', 'Loading session...');
  const meta = await fetchLiveSetsSessionMeta(sessionId);

  if (!meta?.urlAudio?.length) {
    setLiveSetsCardPlayerState(card, 'has-error', 'Player could not load right now.');
    return null;
  }

  audio.replaceChildren();
  meta.urlAudio.forEach((sourceData) => {
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
  if (!card || !card.classList.contains('active')) return;
  const audio = await loadLiveSetsCardPlayer(card);
  if (!audio) return;

  getLiveSetsSessionCards().forEach((otherCard) => {
    if (otherCard !== card) pauseLiveSetsCardPlayer(otherCard);
  });

  try {
    await audio.play();
    card.classList.add('is-playing-session');
  } catch (error) {}
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
      const count = document.createElement('span');
      count.className = 'youtube-card-count';
      count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(YOUTUBE_VIDEOS.length).padStart(2, '0')}`;
      top.append(source, count);

      const player = document.createElement('span');
      player.className = 'youtube-card-player';
      player.dataset.youtubePlayer = '';
      player.style.setProperty('--youtube-thumb', `url("${video.thumbnail}")`);
      const frame = document.createElement('iframe');
      frame.className = 'youtube-card-frame';
      frame.title = `${video.title} YouTube video`;
      frame.loading = 'lazy';
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
      playButton.append(document.createTextNode('Play video'));
      player.appendChild(playButton);

      const note = document.createElement('span');
      note.className = 'youtube-card-note';
      note.textContent = 'HQ audio in Sessions';

      card.append(top, player, note);
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
      card.tabIndex = index === 0 ? 0 : -1;
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
      audio.addEventListener('play', () => card.classList.add('is-playing-session'));
      audio.addEventListener('pause', () => card.classList.remove('is-playing-session'));
      audio.addEventListener('ended', () => card.classList.remove('is-playing-session'));
      const playerStatus = document.createElement('span');
      playerStatus.className = 'sessions-card-player-status';
      playerStatus.dataset.livesetsPlayerStatus = '';
      player.append(audio, playerStatus);

      card.append(top, title, meta, action, player);
      slide.appendChild(card);
      list.appendChild(slide);
    });
    addLiveSetsSessionClones(list);
  });
  renderLiveSetsCarouselDots(visibleSessions.length, 0);
  setActiveLiveSetsSession(0, { instant: true });
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
    renderLiveSetsSessions(sessions);
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
  setActiveLiveSetsSession(nextIndex, { instant: wrapsAround });
};

const moveYoutubeCarousel = (direction) => {
  const cards = getYoutubeCards();
  if (!cards.length) return;
  const currentIndex = getActiveYoutubeVideoIndex();
  const nextIndex = (currentIndex + direction + cards.length) % cards.length;
  const wrapsAround =
    (direction < 0 && currentIndex === 0) ||
    (direction > 0 && currentIndex === cards.length - 1);
  setActiveYoutubeVideo(nextIndex, { instant: wrapsAround });
};

liveSetsSessionLists.forEach((list) => {
  list.addEventListener('click', (event) => {
    if (event.target.closest('[data-livesets-audio]')) return;
    const card = event.target.closest('.sessions-card[data-livesets-session]');
    if (!card) return;
    playLiveSetsCard(card);
  });

  list.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const card = event.target.closest('.sessions-card[data-livesets-session]');
    if (!card || event.target.closest('[data-livesets-audio]')) return;
    event.preventDefault();
    playLiveSetsCard(card);
  });
});

youtubeVideoLists.forEach((list) => {
  list.addEventListener('click', (event) => {
    const playButton = event.target.closest('[data-youtube-play]');
    if (!playButton) return;
    const card = playButton.closest('.youtube-card[data-youtube-video]');
    playYoutubeCard(card);
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
    if (slides.length <= 1) return;
    if (isAnimating) return;

    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    activePosition -= 1;
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    if (slides.length <= 1) return;
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
    if (slides.length <= 1) return;
    if (isAnimating) return;

    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    activePosition -= 1;
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    if (slides.length <= 1) return;
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
// "Next Event" block and move that event to the top of the past-events archive.
const checkEventExpiry = () => {
  const eventContainer = document.querySelector('[data-next-event-container]');
  const eventCard = document.querySelector('[data-event-end]');

  if (!eventContainer || !eventCard) return;

  const endDate = eventCard.getAttribute('data-event-end');

  if (!endDate) return;

  const eventEndTime = new Date(endDate);
  const now = new Date();

  if (now > eventEndTime) {
    eventContainer.style.display = 'none';

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
