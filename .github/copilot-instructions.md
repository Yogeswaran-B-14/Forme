# FORME project rules

- Read BUILD_GUIDE.md before making architectural decisions. It is the source of truth.
- Stack: React 18 + TypeScript (strict) + Vite + Tailwind CSS, Supabase (Auth, Postgres, Storage, Edge Functions), pnpm workspaces.
- Mobile-first. Design for a 390px-wide viewport first. All tap targets >= 44x44px.
- Use design tokens from apps/web/src/styles/tokens.css and tailwind.config.ts. Never hard-code hex colours in components.
- Server state via TanStack Query. Local UI state via Zustand. Forms via react-hook-form + zod.
- Never put business logic in components. Outfit logic lives in packages/outfit-engine (pure functions, no I/O).
- Every table has Row Level Security. Never use the Supabase service-role key in client code.
- Write unit tests (Vitest) for every function in packages/outfit-engine.
- Prefer small, typed, named-export modules. No `any`. No default exports except route components.
- Commit in small steps with conventional commit messages (feat:, fix:, chore:, test:).
