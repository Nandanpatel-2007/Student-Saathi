# Student Saathi: Frontend

React 19 + TypeScript (strict) + Vite + Tailwind CSS. A public landing page, role-based login, and three portals
(student, faculty, admin) that talk to the Django API in `../backend`.

## Requirements

Node.js 20.19+ (developed on Node 24) and npm. The backend must be running (see `../backend/README.md`), ideally
with `python manage.py seed_demo` applied.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check (tsc -b) and production build into dist/
npm run preview    # serve the production build on port 5173
npm run lint       # ESLint
npm test           # Vitest unit tests for the pure helpers
```

The dev server is pinned to port **5173** (`strictPort`), the origin the backend's CORS allows by default. To use
another port (for example `npm run dev -- --port 5174`), add that origin to `CORS_ALLOWED_ORIGINS` in the
backend's `.env` and restart the backend.

## Configuration

Copy `.env.example` to `.env` to override values. `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`) is
the API the app talks to.

## What is where

```
src/
  auth/         AuthProvider, ProtectedRoute, token storage, safe ?next= handling
  components/   shared UI: ui/ (Card, Button, Field, Modal, ...), PortalShell, plus faculty/, student/,
                admin/ and assignments/ pieces, and the landing-page sections
  pages/        Landing, Login, NotFound, and one folder per portal: student/, faculty/, admin/
  hooks/        useAsyncData, useSelectedClass, useSearchPaging, useTheme, ...
  lib/          typed API clients (*-api.ts, zod-validated), pure helpers (timing, compare, marks, ...) and
                their *.test.ts files
  content/      landing-page and login copy
  index.css     theme tokens (CSS variables) and Tailwind setup
```

Routes: `/` landing, `/login`, then `/student/*`, `/faculty/*` and `/admin/*`, each guarded by role.

## Conventions

- **API:** every call goes through `src/lib/api.ts` (bearer token, one refresh-and-retry on 401, errors parsed into
  `ApiError`). Responses are validated with zod, so a changed backend shape fails loudly rather than rendering `NaN`.
- **Dates and times:** the product speaks **Asia/Kolkata (IST)**. Use the helpers in `src/lib/format.ts`
  (`formatDateTime`, `todayISO`, `toIstInputValue` / `istInputToIso` for `datetime-local` inputs) and
  `src/lib/timing.ts` (`formatTiming`, `formatDue`); never format dates with the browser's own zone.
- **Missing data:** a `null` from the API is shown as "No data yet" (or a dash inside narrow table cells), never as 0.
- **Uploads:** the allowed types and the 10 MB limit live in `src/lib/upload-limits.ts` and mirror the backend's
  `apps/assignments/uploads.py`; the backend is the real check.
- **Accessibility:** status is always icon + text, charts have a text table, dialogs use the native `<dialog>`,
  live regions announce save and upload results, and focus rings come from one global rule.

## Theming

Colours are CSS variables in `src/index.css`. The theme follows the OS preference; the toggle sets
`html[data-theme]` and saves the choice in `localStorage` (`ss-theme`). Charts read the same variables, so they work
in both themes. Motion (parallax, scroll reveals, particle drift) is off under `prefers-reduced-motion`, and
parallax is also off on touch devices.
