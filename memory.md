# Project memory

## Product intent & audience

- **UiTM ScholarGuard**: plagiarism + AI detector, sentence highlighting, paraphrase assistant, document history, academic repository.
- Audience: UiTM students and lecturers; bilingual context (Bahasa Melayu / English).

## Brand personality & voice

- Academic, trustworthy, modern. Malaysian institutional context.
- Interface language is user-selectable; both BM and EN are first-class.

## Visual design & UX direction

- Stack: Vite + React (JSX), Tailwind CSS, Lucide React icons, `@/` path alias to `src/`.
- Navbar contains both a **Dark Mode / Light Mode** toggle and a **BM / EN language switch** placed side by side.
- Language preference persists across refresh (likely localStorage).
- No extra UI/theme/icon packages beyond what the template provides.

## Decisions, constraints & rationale

- `jspdf` is an approved dependency (used for PDF export); must be properly installed/resolvable by Vite.
- Bilingual UI implemented via a language switch that updates core surfaces: navbar, dashboard, reports, history, repository, help panel, analysis status.
- Do not add UI libraries beyond Tailwind/Lucide unless explicitly requested.
- Keep designs production-grade and non-cookie-cutter.

## Open questions & assumptions

- Translation coverage assumed across main surfaces; deeper/nested strings may still need auditing.
- Exact i18n mechanism (context vs. state vs. dictionary object) not yet documented in code.
- PDF export scope (what content, report format) not fully specified.