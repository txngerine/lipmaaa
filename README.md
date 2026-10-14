# Living Particles

A generative portrait experiment: an image is sampled into thousands of particles that breathe, drift, and respond to your cursor on a full-screen canvas. No frameworks, no build step — plain HTML, CSS, and JavaScript.

## Features

- **Image → particles**: the portrait is sampled on a luminance-weighted grid, so bright areas become denser and darker areas fall away into dust.
- **Five studies**: Breathing portrait, Orbital bloom, Electric current, Constellation (nearest-neighbour links), Kaleidoscope.
- **Pointer field**: attract or repel the particles around the cursor.
- **Controls**: motion toggle, energy slider, particle colour picker.
- **Bring your own image**: upload via the button or drag-and-drop (max 20 MB, images only); switch between sources with the thumbnails.
- **Export**: save a clean PNG of the current frame, without the UI overlay.
- **Performance-minded**: device-pixel-ratio capped at 2, rendering pauses when the tab is hidden, and particle layout is seeded so each resize rebuilds the same composition.

## Getting started

The page samples image pixels with `getImageData`, so it must be served over HTTP — opening `index.html` from the filesystem will fail the canvas with a tainted-canvas error.

```bash
# Python
python3 -m http.server 5173

# or Node
npx serve .
```

Then open <http://localhost:5173>.

## Deploying to Vercel

Import the repository in the Vercel dashboard, or use the CLI:

```bash
npm i -g vercel
vercel
```

No build command or output directory is required; `vercel.json` configures clean URLs plus caching and security headers.

## Project structure

```
index.html            Page shell and HUD controls
css/styles.css        Layout, HUD, and control styling
js/portrait-data.js   Fallback portrait source (data URI)
js/app.js             Particle sampling, studies, rendering, and input
assets/               Default portrait image
vercel.json           Vercel deployment configuration
```

## How it works

1. The active image is drawn to an offscreen canvas and read back as pixels.
2. A seeded PRNG walks a 1.65 px grid, keeping a sample with probability based on its luminance; each particle stores its origin, phase, speed, size, and drift.
3. Every frame, each particle's offset is computed from the selected study's motion function, perturbed by the pointer field, then drawn with additive (`lighter`) blending over a dark vignette.
4. The Constellation study additionally connects each particle to its nearest neighbour within 42 px using a spatial hash grid.

## Browser support

Any current browser with Canvas 2D and `requestAnimationFrame`. Uploaded images stay local (object URLs are revoked on page hide) — nothing is sent anywhere.
