# Student Saathi: Frontend

React + TypeScript (strict) + Vite + Tailwind CSS. This stage contains the landing page only; there is no login,
no dashboards and no API calls yet.

## Requirements

Node.js 20.19+ (developed on Node 24) and npm.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check (tsc -b) and production build into dist/
npm run preview    # serve the production build on port 5173
npm run lint       # ESLint
```

The dev server is pinned to port **5173** (`strictPort`), which is the origin the backend's CORS allows. If the port
is taken, Vite exits instead of picking another one.

## Configuration

Copy `.env.example` to `.env` to override values. `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`) is
reserved for later work and is not used yet.

## Layout

```
src/
  components/   UI pieces (Navbar, Hero, ParticleField, ...)
  pages/        Route components: Landing, Login (placeholder), NotFound
  hooks/        useParallax, useReveal, useTheme, useMediaQuery, ...
  content/      landing.ts: all landing-page copy
  lib/          small helpers (theme store, cn)
  types/        shared TypeScript types
  index.css     theme tokens (CSS variables) and Tailwind setup
```

## Theming

Colours are CSS variables in `src/index.css`. The theme follows the OS preference; the navbar toggle sets
`html[data-theme]` and saves the choice in `localStorage` (`ss-theme`). Motion (parallax, scroll reveals,
particle drift) is switched off under `prefers-reduced-motion`, and parallax is also off on touch devices.
