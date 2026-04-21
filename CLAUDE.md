# CLAUDE.md

This file documents project conventions, architecture, and maintenance instructions for Claude Code.
Update this file whenever the project structure, tooling, or conventions change significantly.

---

## Project overview

A static-site starter template built with SvelteKit, Tailwind CSS 4, and GSAP. Intended as a
workshop starting point that forks cleanly — the landing page demonstrates the stack but is meant
to be replaced.

Deployment target: GitHub Pages (static output via `@sveltejs/adapter-static`).

---

## Commands

```bash
npm run dev          # Start dev server (no BASE_PATH applied in dev)
npm run build        # Production build (set BASE_PATH env var for GitHub Pages subpaths)
npm run preview      # Preview the production build locally
npm run check        # Type-check with svelte-check
npm run check:watch  # Type-check in watch mode
```

Docker helpers (optional):
```bash
npm run docker:dev:build   # Build the dev Docker image
npm run docker:dev:run     # Run the dev container
```

---

## Architecture

```
src/
  app.html              # HTML shell — edit <head> globals here
  app.d.ts              # SvelteKit ambient types
  lib/
    index.ts            # Re-exports everything from $lib — import GSAP from here, not directly
    gsap.ts             # GSAP wrapper: withGsapContext, motionAllowed
    assets/
      favicon.svg
  routes/
    +layout.ts          # Sets prerender = true and trailingSlash = 'always' for all routes
    +layout.svelte      # Imports layout.css, renders favicon, sets default <meta>
    layout.css          # Global CSS — Tailwind base import lives here
    +page.svelte        # Landing page — replace with your content
```

New routes follow the SvelteKit file-based convention: add a folder under `routes/` with a
`+page.svelte`. All routes are prerendered (static output).

---

## Key conventions

### Svelte 5 runes mode

Runes mode is **forced for all non-library files** via `svelte.config.js`:

```js
compilerOptions: {
  runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
}
```

Always use Svelte 5 syntax: `$state()`, `$derived()`, `$props()`, `$effect()`. Do not write
Svelte 4 reactive syntax (`$:`, `export let`).

### GSAP animations

- **Always import GSAP through `$lib`**, never directly from `gsap`:
  ```ts
  import { withGsapContext } from '$lib';   // correct
  import { gsap } from 'gsap';              // wrong — bypasses SSR guard + cleanup
  ```

- **Always use `withGsapContext(scopeElement, setup)`** in `onMount`. It handles:
  - SSR guard (`typeof window !== 'undefined'`)
  - `prefers-reduced-motion` — returns early with a no-op cleanup if motion is reduced
  - Scoped context cleanup — the return value of `onMount` calls `context.revert()`

  ```ts
  onMount(() => {
    return withGsapContext(page, (gsap) => {
      // animations here
    });
  });
  ```

- **Animation target classes use the `js-gsap-*` prefix** (e.g. `js-gsap-title`, `js-gsap-card`).
  These are selector hooks for GSAP — do not remove or rename them without updating the
  corresponding animation code.

### Base path (GitHub Pages)

The production base path is read from the `BASE_PATH` environment variable at build time
(`svelte.config.js`). In dev it is always `''`.

When deploying to a GitHub Pages project subdirectory (e.g. `username.github.io/repo-name`),
set `BASE_PATH=/repo-name` before building. Asset paths inside Svelte templates resolve correctly
via SvelteKit's `base` — do not hardcode `/` prefixes on internal links or asset imports.

### Static adapter settings

Set in `src/routes/+layout.ts` — applies to every route:
- `prerender = true` — all pages are statically generated
- `trailingSlash = 'always'` — URLs end with `/` for GitHub Pages compatibility

Do not override these per-route unless you have a specific reason and understand the impact on
the static build.

### Tailwind CSS 4

Tailwind is integrated via `@tailwindcss/vite` (the Vite plugin approach, not PostCSS). There is
no `tailwind.config.*` file — configuration is done in CSS using `@theme` if needed. The base
import lives in `src/routes/layout.css`.

---

## CLAUDE.md maintenance

**Update this file when any of the following change:**

- New routes or major layout changes are added
- New libraries or devDependencies are introduced
- GSAP helpers or animation conventions evolve
- The build/deployment configuration changes (adapter, base path, env vars)
- New naming conventions or project-wide patterns are established
- The project is forked from the template and repurposed — update the overview to reflect its
  actual purpose

To trigger an update, tell Claude: _"Update CLAUDE.md to reflect the current state of the project."_
Claude should re-read the files that changed, reconcile them with this document, and edit only the
sections that are stale — not rewrite the whole file.
