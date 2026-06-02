# Theme Packages

Each theme lives in its own folder:

- `index.ts`: exports the typed `theme` definition and imports any theme CSS
- `defaults.ts`: returns theme-specific thumbnail defaults
- `Theme.svelte`: the renderable 1280x720 thumbnail component
- `theme.css`: optional shared CSS for the theme
- `assets/`: theme-only fonts, images, and artwork

Notes:

- Theme IDs must be kebab-case.
- Keep app shell styles in `src/routes/layout.css`.
- Keep thumbnail render styles and theme assets inside the package.
- Use `npm run theme:new -- <theme-id>` to scaffold a new package.
- Speaker cards are rendered by `html-to-image` for export. Do not put `backdrop-filter` or `box-shadow` on `.speaker-card` rules; those effects can rasterize as semi-transparent rectangular bands around rounded pills. Use solid fills and borders instead.
- Run `npm run check:theme-render` after copying a theme. It fails when a copied `.speaker-card` rule reintroduces those export artifacts.
