# PROMPT VAULT

**Your AI Prompts. Organized. Optimized. Always Ready.**

A complete, production-oriented prompt-management SaaS implementing **V1–V5** in one unified app:
core prompt management, advanced organization, version control, a real AI Prompt Engineering lab,
and multi-user authentication with secure cloud sync.

## Feature map

| Version | Delivered |
|---|---|
| **V1** | Create/edit/soft-delete/restore/permanent-delete, one-click copy (formatting preserved, clipboard error handling), instant search across title/description/content/categories/tags with highlighting, 11 predefined + custom categories (safe deletion → Uncategorized), 6 sort modes combined with filters, usage tracking on copy only |
| **V2** | Favorites & Pinned pages, full tag CRUD + filtering + search, multi-membership collections, smart views (recently used/created/updated, most used, untagged, uncategorized), bulk actions with confirmations |
| **V3** | Version snapshot on every save, LCS line diff comparison, safe restore (creates a new version, never destroys history), version timeline, autosave recovery drafts, unsaved-changes warning |
| **V4** | AI Lab: Improve, Generate, Rewrite (7 styles), Analyze, 2–5 Variations, multi-turn Refine Chat. Every result: copy, save as new, update existing (versioned), tags, collections. Secure Edge Function backend: JWT auth, validation, per-user hourly rate limit, honest "not configured" state — never fake responses |
| **V5** | Supabase auth (signup/login/logout/verify/forgot/reset, persistent sessions), profiles, full PostgreSQL schema + migration, RLS on every private table + ownership triggers, cloud sync with conflict resolution, local-first IndexedDB mode, offered local→cloud merge, JSON/TXT/MD export, validated import with preview + duplicate handling |

Plus: dark/light/system themes, preferences, account management, typed-confirmation account deletion,
starter library (2 exact prompts, seeded once), keyboard shortcuts, toasts with undo, responsive layouts.

The Friends/Teams/Shared area adds handle-based friend requests, private direct and team chat,
team invitations and roles, explicit revocable prompt snapshots, reporting/blocking, and
recipient-owned “Save to My Vault” copies. Collaboration requires an authenticated Supabase
project and both migrations; local-only mode never shows sample people or claims to send messages.
Prompt data is not public: source prompts remain owner-only unless deliberately shared.

## Stack

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Lucide · React Router 6 · Zod ·
Supabase (Postgres, Auth, RLS, Edge Functions) · Vitest.
Data layer: typed repository/store (LocalAdapter ↔ IndexedDB, CloudAdapter ↔ Supabase) with optimistic updates.

## 1 · Install & run (zero-config local mode)

```bash
npm install
npm run dev        # http://localhost:5173 — full app works locally via IndexedDB
```

Without credentials the app runs in **local mode**: every non-cloud feature works.
AI and sync show honest setup messages.

## 2 · Environment variables

```bash
cp .env.example .env
```

| Variable | Where | Purpose |
|---|---|---|
| VITE_SUPABASE_URL | frontend .env | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | frontend .env | Public anon key (safe: RLS protects data) |
| AI_API_KEY | **function secret only** | Provider key — never in frontend, never VITE_ |
| AI_BASE_URL | function secret | Default https://api.openai.com/v1 |
| AI_MODEL | function secret | Default gpt-4o-mini |
| AI_RATE_LIMIT_PER_HOUR | function secret | Default 30 |
| ALLOWED_ORIGIN | function secret | Restrict CORS in production |

**You must supply your own Supabase project and AI provider key. Nothing is pre-configured.**

## 3 · Supabase setup (cloud sync + auth)

1. Create a project at supabase.com.
2. Apply the ordered migrations `supabase/migrations/0001_init.sql`,
   `supabase/migrations/0002_community.sql`, and
   `supabase/migrations/0003_harden_trigger_helpers.sql` to a fresh project. They create
   the personal vault, private collaboration, and hardened app-owned trigger helpers. Review
   all migrations and confirm the target project before applying them to an existing database.
   With the Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
3. Copy Project URL + anon public key (Settings → API) into .env.
4. Auth → Providers → Email: enable and keep email confirmation on. Set the production Site URL
   and add `http://localhost:5173/auth` (for local development) and your production `/auth` URL
   to Auth → URL Configuration → Redirect URLs. For public sign-ups, configure custom SMTP:
   Supabase's built-in sender is for testing and only sends to project team addresses.
5. Restart npm run dev and sign up. Profile + settings rows are auto-provisioned by a DB trigger.
   Collaboration uses `/friends`, `/teams`, and `/shared`; migration 0002 adds the message tables
   to the `supabase_realtime` publication. Never expose a service-role key in browser code. Only
   the project URL and anon key belong in `VITE_` variables.

## 4 · AI provider configuration

```bash
npx supabase functions deploy ai
npx supabase functions deploy delete-account
npx supabase secrets set AI_API_KEY=YOUR_KEY
# optional:
npx supabase secrets set AI_MODEL=gpt-4o-mini AI_BASE_URL=https://api.openai.com/v1 AI_RATE_LIMIT_PER_HOUR=30 ALLOWED_ORIGIN=https://your-app.com
```

Any OpenAI-compatible provider works (OpenAI, Groq, OpenRouter, Together…) — set AI_BASE_URL + AI_MODEL.
Local dev: `npx supabase functions serve ai --env-file .env`

Behavior: unconfigured → setup card · signed out → sign-in prompt · 429 → limit message · provider down → useful error.

## 5 · Scripts, tests, build, zip

```bash
npm run dev         # develop
npm test            # unit tests: diff, search/sort/filter, version restore chain, backup validate/merge, seed exactness
npm run typecheck   # strict TS
npm run build       # production build → dist/
npm run preview     # serve the build locally
npm run zip         # creates prompt-vault.zip of the full source (no dependencies needed)
```

**Testing scope — honest statement:** the Vitest suite covers pure application logic and static
collaboration-schema contracts. Those static checks are not a substitute for executing PostgreSQL
policies. End-to-end cloud/auth/AI and two-account RLS checks require a separate Supabase test
project and test accounts. Never use real user data for authorization tests. Verify with this checklist:

- [ ] Sign up → verify email → sign in → sign out → reset password via email link
- [ ] Create/edit/copy/search/delete/restore a prompt; refresh — data persists; second browser sees it
- [ ] Two accounts cannot read each other's rows (RLS)
- [ ] Two accounts verify accepted-friend/team chat boundaries, explicit share/revocation, block/removal behavior, and independent saved copies
- [ ] Edit twice → History → Compare → Restore v1 → v1–v4 all exist
- [ ] Bulk select → favorite/category/tag/collection/export/delete
- [ ] AI: each mode with a key; remove secret → setup card; bad key → provider error
- [ ] Export JSON → import on second account → preview, skip vs copy duplicates
- [ ] Same prompt edited in two tabs → conflict dialog → both resolutions
- [ ] Desktop / tablet / mobile; Cmd+K, Cmd+N (or n), Cmd+S, Escape

## 6 · Deployment

Static SPA — deploy dist/ to Vercel (vercel.json included), Netlify (netlify.toml + _redirects included),
or Cloudflare Pages. Build: npm run build · Output: dist · Env: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
Add your production URL to Supabase Auth Redirect URLs; set ALLOWED_ORIGIN on the functions.

## 7 · Architecture notes

- **Versions:** git-style snapshots — v1 on create, new snapshot on every editor/AI/restore save.
  Restore = new version with old content; history is append-only. Flags/links/usage don't create versions.
- **Conflicts:** content edits carry expectedVersion; guarded cloud update; zero rows ⇒ conflict dialog
  (keep mine / use cloud), then resync. Failed writes roll back with an error toast; offline is surfaced.
- **Merges/imports:** one pure planner (planMerge): name-matched taxonomy, content-hash dedupe,
  ID-collision regeneration, version remapping — never overwrites existing data.
- **Usage** increments only on successful clipboard copy of a stored prompt.

## 8 · Troubleshooting

| Symptom | Fix |
|---|---|
| "Cloud sync not configured" | .env missing/blank, or dev server not restarted |
| Reset link opens wrong page | Add your-origin/auth to Auth Redirect URLs |
| AI "not configured" | Deploy ai function AND set AI_API_KEY secret; re-check |
| AI 401 | Session expired — sign in again |
| AI 429 | Hourly per-user limit or provider-side limit |
| RLS policy violation | Rows must carry the signed-in user's user_id (imports remap automatically) |
| Clipboard fails | Serve over HTTPS/localhost; fallback + message shown |
| Ctrl+N opens browser window | Some browsers reserve it; plain n (outside inputs) also works |
| Functions CORS locally | supabase functions serve + ALLOWED_ORIGIN=your dev origin |

## 9 · Known limitations (disclosed)

- Collaboration realtime is limited to direct/team messages; no typing indicators, presence, or delivery receipts.
- Chat history loads in bounded pages of up to 100 messages; shared prompt lists are capped at 100 rows per request.
- OAuth not wired (email/password complete); can be added via Supabase later.
- AI quality/limits depend on your provider; analysis is labeled subjective.
