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
  'Click anywhere to enter',
  'Scanning rave memory...',
  'Calibrating rhythm engines...',
  'Warning dark matter...',
  "Rendering cosmos..."
];
let loaderMessageTimer = null;
let ticking = false;

// Prevent scroll restoration on Android
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Ensure starting at top
window.scrollTo(0, 0);

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
  
  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-tab');
      setActiveTab(target);
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
  resizeTimer = setTimeout(handleScroll, 150);
}, { passive: true });

const getLiveIndicators = () => document.querySelectorAll('[data-live-indicator]');
const getLiveLabels = () => document.querySelectorAll('[data-live-label]');
const hasLiveTargets = () => getLiveIndicators().length || document.querySelector('[data-live-banner]');

const updateLiveIndicator = (isLive) => {
  const state = Boolean(isLive);
  getLiveIndicators().forEach((indicator) => indicator.classList.toggle('is-live', state));
  document.querySelectorAll('[data-live-banner]').forEach((banner) => banner.classList.toggle('is-live', state));
  
  // Update mobile live link
  const mobileLiveLinks = document.querySelectorAll('[data-live-mobile-link]');
  const mobileLiveTexts = document.querySelectorAll('[data-live-mobile-text]');
  
  mobileLiveLinks.forEach((link) => {
    if (state) {
      link.href = 'https://livesets.com/cidirilk/live';
      link.classList.remove('offline');
    } else {
      link.href = 'https://livesets.com/cidirilk/sessions';
      link.classList.add('offline');
    }
  });
  
  mobileLiveTexts.forEach((text) => {
    text.textContent = state ? 'LIVE NOW' : 'Sessions';
  });
  
  getLiveLabels().forEach((label) => {
    label.textContent = state ? 'LIVE NOW' : 'Offline';
  });
  
  // Show/hide "Open radio" button in desktop popup
  const liveRadioBtns = document.querySelectorAll('[data-live-radio-btn]');
  liveRadioBtns.forEach((btn) => {
    btn.style.display = state ? 'flex' : 'none';
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
  const closeBtn = document.querySelector('[data-collab-modal-close]');
  const modalIcon = document.querySelector('[data-collab-modal-icon]');
  const modalTitle = document.querySelector('[data-collab-modal-title]');
  const modalBody = document.querySelector('[data-collab-modal-body]');
  const collabCards = document.querySelectorAll('[data-collab-id]');

  if (!modal || !collabCards.length) return;

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

    // Update modal content
    modalIcon.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
    modalTitle.textContent = data.title;
    modalBody.innerHTML = data.content;

    // Show modal
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    
    // Focus the close button for accessibility
    setTimeout(() => closeBtn?.focus(), 100);
  };

  // Close modal function
  const closeModal = () => {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
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

// Check and hide expired events
const checkEventExpiry = () => {
  const eventContainer = document.querySelector('[data-next-event-container]');
  const eventCard = document.querySelector('[data-event-end]');
  
  if (!eventContainer || !eventCard) return;
  
  const endDate = eventCard.getAttribute('data-event-end');
  
  if (!endDate) return;
  
  const eventEndTime = new Date(endDate);
  const now = new Date();
  
  // Hide the entire event container if the event has ended
  if (now > eventEndTime) {
    eventContainer.style.display = 'none';
  }
  // Otherwise, ensure it's visible (remove any display style)
  else {
    eventContainer.style.display = 'block';
  }
};

// Initialize carousel after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
    initCollabCarousel();
    initCollabModal();
    checkEventExpiry();
  });
} else {
  initCarousel();
  initCollabCarousel();
  initCollabModal();
  checkEventExpiry();
}
