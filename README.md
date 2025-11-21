# cidirilk.com

Dark-to-light landing page for CIDIRILK, the music exploration alias of Charalampos Kliridis. The layout mirrors kliridic.com's typography while pairing mirrored branding, exploration-first hero content, and software-focused sections.

## Stack and structure
```
cidirilk/
|-- index.html        # Home, About, Softwares, Collaborations, Contact sections
|-- assets
|   |-- css/main.css  # Minimal palette, nav, responsive grid utilities
|   `-- js/script.js  # Theme toggle, sticky nav, intersection observer
|-- CNAME             # Points GitHub Pages at cidirilk.com
`-- README.md         # Project notes
```

Everything is pure HTML/CSS/JS, so you can also drag the folder into any static host (Pages, Netlify, Cloudflare, S3, etc.).

## Deployment on GitHub Pages
1. Push this folder to a repo (for example `cidirilk.github.io` or any repo with Pages enabled).
2. In the repository settings, enable Pages with the `main` branch and `/ (root)`.
3. Commit the `CNAME` file so GitHub keeps the custom domain.
4. Each push to the default branch will rebuild the site automatically.

## Pointing `cidirilk.com`
1. Create four `A` records for the root domain that point to GitHub Pages IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
2. Create a `CNAME` record for `www` that targets `cidirilk.github.io` (or your repo subdomain).
3. In the Pages settings, specify `cidirilk.com` as the custom domain and enforce HTTPS.

## Customizing the sections
- **Navigation**: Update section ids or nav labels inside `index.html`. The script automatically highlights links when a section is in view.
- **Theme**: Adjust the neutral palette at the top of `assets/css/main.css`. The theme toggle flips between dark (`--bg` black) and light (white) modes.
- **Software section**: Update the cards inside `#softwares` to reflect the tools you’re currently experimenting with.
- **Responsive tweaks**: To adjust breakpoints or stacking behavior, edit the media queries near the end of `assets/css/main.css`.

Feel free to reuse this scaffold for other aliases since it is dependency free and stays within the monochrome aesthetic.


