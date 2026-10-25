# FORME
Core scaffold generated from docs/BUILD_GUIDE.md.
## Run
1. `pnpm install`
2. `npx supabase init` is already done in spirit: migrations live in supabase/migrations. Run `npx supabase start` (Docker running), then `npx supabase db reset`
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the local URL and anon key
4. `pnpm test` then `pnpm dev`
## Next
Continue with Phase 4 (Wardrobe + image pipeline) onward in docs/BUILD_GUIDE.md using GitHub Copilot.
