# CIDIRILK

🔗 **Live Site**: [https://cidirilk.com/](https://cidirilk.com/)

Electronic music navigator portfolio site for CIDIRILK (Kliridis Charalampos). A modern, responsive single-page application featuring radio shows, live performances, and sonic experiments.

## Features

- 🎨 **Dark/Light Theme Toggle** - Smooth theme switching with localStorage persistence
- 📱 **Fully Responsive** - Optimized for desktop, tablet, and mobile
- ♿ **Accessible** - WCAG 2.1 AA compliant with keyboard navigation
- 🎵 **Live Status Integration** - Real-time LiveSets broadcast indicator
- 💬 **Integrated Chat** - hack.chat integration with custom nickname prompt
- 🎠 **Event Carousel** - Showcases past events with smooth animations
- 🍪 **Cookie Storage** - Remembers user preferences (theme, chat nickname)
- ⚡ **Performance Optimized** - Fast loading, smooth animations, GPU-accelerated

## Project Structure

```
cidirilk.github.io/
├── index.html           # Main HTML file
├── assets/
│   ├── css/
│   │   └── main.css    # All styles (1900+ lines)
│   └── js/
│       └── script.js   # All functionality (500+ lines)
├── CNAME               # Custom domain configuration
└── README.md           # This file
```

## Tech Stack

- **HTML5** - Semantic markup with structured data (JSON-LD)
- **CSS3** - Custom properties, flexbox, grid, animations
- **Vanilla JavaScript** - No frameworks or dependencies
- **Font Awesome 6.5.1** - Icon library
- **Google Fonts** - Space Grotesk typeface

## Key Components

### Theme System
- Dark theme (default)
- Light theme
- System preference detection
- Persistent storage in localStorage
- Mobile-optimized with forced repaint

### Navigation
- Sticky header with blur effect
- Tab-based content sections (Social, Past Events, Collaborations, Subscribe)
- Smooth scroll behavior
- Mobile-responsive menu

### Live Status
- Polls LiveSets API every 15 seconds
- Desktop popup notification
- Mobile header indicator
- Auto-redirects to live stream or sessions page

### Chat Integration
- Custom nickname prompt with astronaut theme
- hack.chat iframe integration
- Cookie-based nickname storage (1 year)
- Keyboard shortcuts (Escape to close)
- Touch-friendly on mobile

### Event Carousel
- 4 past events with navigation
- Left/right arrow buttons
- Dot indicators
- Keyboard navigation (Arrow keys)
- Touch swipe support
- Smooth spring animations

## Deployment

### GitHub Pages
1. Push to repository
2. Enable Pages in Settings → Pages
3. Set source to `main` branch, `/ (root)`
4. Site auto-deploys on every push

### Custom Domain Setup
1. Add `A` records pointing to GitHub Pages IPs:
   - 185.199.108.153
   - 185.199.109.153
   - 185.199.110.153
   - 185.199.111.153
2. Add `CNAME` record: `www` → `cidirilk.github.io`
3. In Pages settings, add custom domain and enforce HTTPS

## Email Subscription

The Subscribe tab is backed by a Cloudflare Worker (`subscribe-worker.js`) that
proxies the [Brevo](https://www.brevo.com/) API. The Brevo API key stays a
server-side secret, so the static site never exposes any credential. Subscribers
go through Brevo's double opt-in (they must confirm via email before being added).

### One-time setup

1. In Brevo: create a contact list (note its id), create a Double Opt-In
   confirmation email template (note its id), and generate an API key.
2. In `subscribe-worker.toml`, set `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID`, and
   `DOI_REDIRECT_URL` (e.g. `https://cidirilk.com/?subscribed=1`).
3. Store the API key as a secret:
   ```bash
   wrangler secret put BREVO_API_KEY -c subscribe-worker.toml
   ```
4. (Optional) Enable per-IP rate limiting:
   ```bash
   wrangler kv namespace create RATE_LIMIT
   ```
   Paste the id into `subscribe-worker.toml` and uncomment the `[[kv_namespaces]]` block.
5. Deploy and copy the worker URL:
   ```bash
   wrangler deploy -c subscribe-worker.toml
   ```
6. Set `SUBSCRIBE_ENDPOINT` in `assets/js/script.js` to that URL.

Security features: origin allow-list + CORS, server-side email validation,
honeypot spam trap, Cloudflare Turnstile (server-side siteverify in the Worker),
optional rate limiting, and no secrets in the client.

### Turnstile setup

The subscribe form is protected by [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/).
The widget site key is embedded in `index.html`; the secret is a Worker secret:

```bash
wrangler secret put TURNSTILE_SECRET_KEY -c subscribe-worker.toml
```

The Worker verifies the `cf-turnstile-response` token server-side before calling
Brevo and fails closed (rejects with `failed_captcha` if the token is missing or
the secret is unset). Set the secret before deploying, or subscriptions will be
blocked.

For local browser previews on `localhost`, `127.0.0.1`, `0.0.0.0`, or `::1`,
the site renders Cloudflare's public always-pass test sitekey to avoid launching
real production challenges during development. End-to-end local subscription
tests require a local Worker using Cloudflare's matching test secret key; the
deployed production Worker will reject dummy Turnstile tokens.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

## Performance

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.0s
- Lighthouse Score: 95+ across all metrics

## Customization

### Colors
Edit CSS custom properties in `assets/css/main.css`:
```css
:root {
  --accent-neon: #c174ff;
  --bg: #050505;
  --text: #f7f7f7;
  /* ... */
}
```

### Content
Update profile text, events, and social links in `index.html`

### LiveSets Integration
Update endpoint in `assets/js/script.js`:
```javascript
const LIVESETS_STATUS_ENDPOINT = 'your-endpoint-here';
```

## License

All rights reserved © CIDIRILK

## Built By

[Kliridic](https://kliridic.com/)

---

**Version**: 2.0.0  
**Last Updated**: November 2024
