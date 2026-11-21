# Project memory

## Product intent & audience

- App name: **UiTM ScholarGuard** — a web app for UiTM (Universiti Teknologi MARA) students, likely scholarship/academic management or protection related.
- Audience: UiTM students; sign-in is restricted to UiTM email accounts.
- A demo login button is provided for non-production access.

## Brand personality & voice

- Institutional and professional, aligned with a university context.
- Trust-oriented (guard/protection framing).

## Visual design & UX direction

- Entry point is a login screen offering: UiTM email sign-in, account creation, and demo login.
- No detailed visual/UX direction inferred yet beyond the login screen.

## Decisions, constraints & rationale

- Framework: **Vite + React**.
- Backend: **Supabase** (connection/client file lives at project root).
- Project structure: app files and Supabase client live at the **project root**, not under `src/`. Import paths and `index.html` entry pointers must reference root-level files, not `src/`.
- Fixed two broken references caused by incorrect `src/` path assumptions (entry file pointer and Supabase import).
- Dev server and preview run automatically in Bolt; no manual start needed.

## Open questions & assumptions

- Core features beyond authentication are unknown (what "ScholarGuard" manages/protects).
- Supabase schema, tables, and auth configuration details not yet surfaced.
- Full visual design system, typography, color palette, and layout patterns not yet established.