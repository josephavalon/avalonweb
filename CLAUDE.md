# Avalon Vitality

Mobile IV therapy & longevity concierge (SF Bay Area). Hybrid marketing site + booking web app + member portal. React + Vite + Tailwind. Mobile-first.

## Design System
Always read `DESIGN.md` before making any visual or UX decision. It is the source of truth for principles, typography, color, spacing, layout, and patterns.

North star: **the fastest, safest, scalable, mobile IV experience. Speed kills.**
- Speed is a hard rule, not a vibe: ≤60s checkout, ≤3 taps to book, optimistic UI (<100ms taps), 1-tap pay, pre-filled/deduped address, no full reloads.
- Dark theme is default. Bebas Neue (display) + Inter (body). Use the token system (`tailwind.config.js`, `src/index.css`) — never hardcode hex, font-size, or spacing.
- Menus are wide single-column stacked rows, not cramped multi-column grids.
- 44px touch targets, ≥16px inputs, AA contrast, `focus-visible` rings.

Do not deviate from DESIGN.md without explicit user approval. In QA/review, flag any code that violates it (especially the speed targets and the menu-row pattern).
