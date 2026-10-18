# Petito (web)

Next.js app (App Router) that replaces the old Emergent-hosted FastAPI + React stack. Everything runs on
services you own: **Vercel** (app + API), **Supabase** (Postgres, Storage, Google login), **Inngest**
(background jobs), and direct API keys for **Anthropic**, **fal.ai**, **ElevenLabs** and **Mercado Pago**.

```
src/app/            pages (/universo, /album, /h/[slug] …) and API route handlers (src/app/api/**)
src/screens/        the original React screens, unchanged apart from imports
src/lib/server/     server modules: auth, db, storage, images, prompts, anthropic, fal, elevenlabs, mercadopago, plus
src/lib/render/     slide renderer (port of backend/renderer.py, @napi-rs/canvas + sharp)
src/inngest/        background jobs: story, narration, bonus scenes, portrait, talking video, HD video
supabase/migrations SQL schema (13 tables), indexes, private `media` bucket, admin metrics function
scripts/migrate/    one-time data migration from the old MongoDB + Emergent storage
tests/test_api.py   API acceptance tests (pytest + requests)
```

## 1. One-time setup

### Supabase
1. Create a project (region `sa-east-1`, São Paulo, is closest to Chile).
2. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`
   (or paste the four files in `supabase/migrations/` into the SQL editor, in order).
3. **Authentication → Providers → Google**: enable it and paste the Google client ID/secret (next step).
4. **Authentication → URL configuration**: Site URL `https://petito.pro`; add redirect URLs
   `https://petito.pro/auth/callback`, `http://localhost:3000/auth/callback` and your Vercel preview pattern.
5. Copy the project URL, `anon` key and `service_role` key.

### Google OAuth
Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web application).
Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.

### Vercel
1. Import the repo, set **Root Directory** to `web/`. Use the **Pro** plan (Hobby is non-commercial and
   caps function duration).
2. Add the environment variables from `.env.example` (Production and Preview).
3. Install the **Inngest** integration from the Vercel marketplace; it sets `INNGEST_EVENT_KEY` and
   `INNGEST_SIGNING_KEY` and syncs `/api/inngest` on every deploy.
4. Add the domain `petito.pro` (and `www`).

### Provider keys
| Service | Where | Env var |
|---|---|---|
| Anthropic (Claude) | console.anthropic.com → API keys | `ANTHROPIC_API_KEY` |
| OpenAI (alternative to Claude for text) | platform.openai.com → API keys | `OPENAI_API_KEY` (+ `AI_PROVIDER=openai`) |
| fal.ai | fal.ai/dashboard/keys | `FAL_KEY` |
| ElevenLabs | elevenlabs.io → API keys (same account as today) | `ELEVENLABS_API_KEY` |

Talking videos use ElevenLabs' lip-sync video model by default (`TALK_VIDEO_PROVIDER=elevenlabs`): the
photo and voice clip are sent inline, no public URL needed. It requires an ElevenLabs **Pro plan or above**
and an API key with the *Image & Video* permission. Set `TALK_VIDEO_PROVIDER=fal` to use fal.ai instead.
| Mercado Pago | Tus integraciones → credenciales de producción | `MERCADOPAGO_ACCESS_TOKEN` |

Mercado Pago → Webhooks: URL `https://petito.pro/api/payments/webhook/mercadopago`, events
*Pagos*, *Planes y suscripciones* (`subscription_preapproval`, `subscription_authorized_payment`);
copy the signing secret into `MERCADOPAGO_WEBHOOK_SECRET`.

`PUBLIC_BASE_URL` must be the public origin (`https://petito.pro`): Mercado Pago returns there, and with
`TALK_VIDEO_PROVIDER=fal` fal.ai downloads media from `/api/media/...` on that origin.

## 2. Moving the existing data (once, then again on cutover day)

While the old Emergent app still works, put these in `web/.env.local` next to the Supabase keys:
`MONGO_URL`, `DB_NAME` (the production database, e.g. `cuentapatas-demo-test_database`),
`INTEGRATION_PROXY_URL`, `EMERGENT_LLM_KEY`. They are only used by these scripts; never deploy them.

```bash
npm run migrate:export    # MongoDB → scripts/migrate/out/*.ndjson
npm run migrate:load      # → Supabase Postgres (idempotent upserts; orphans → out/orphans.json)
npm run migrate:objects   # Emergent storage → Supabase Storage (resumable; 404s → out/missing.json)
npm run migrate:verify    # row counts, sample media, users not yet linked
```

If Emergent's MongoDB isn't reachable from your machine, run `migrate:export` from the Emergent shell and
download `scripts/migrate/out/`. Users keep their accounts: the first time someone signs in with Google, the
app links them to their migrated row by email (same `user_…` id, pets, memories and creations).
Old sessions don't carry over, so everyone signs in once more.

**Cutover:** lower the DNS TTL a day before → run the four commands again (only new rows/files move) →
switch petito.pro to Vercel → point the Mercado Pago webhook to the new URL → keep the Emergent app
read-only for ~48 h. Then delete `backend/`, `frontend/`, `.emergent/` and `deployer-agent-docs/`.

## 3. Local development

```bash
cp .env.example .env.local   # fill in a Supabase dev project's keys
npm install
npm run dev                                                   # http://localhost:3000
npx inngest-cli dev -u http://localhost:3000/api/inngest      # background jobs dashboard on :8288
```

- `MOCK_AI=1` replaces Claude, fal.ai and ElevenLabs with local fixtures (no cost, works offline);
  ignored in production.
- fal.ai can't reach `localhost`, so with real AI keys either expose the app with a tunnel and set
  `PUBLIC_BASE_URL` to it, or rely on `MOCK_AI=1`.
- `TEST_SESSION_TOKENS` lets scripts and tests authenticate with `Authorization: Bearer <token>`
  (never set it in production). Then:
  ```bash
  npx tsx scripts/seed-fixtures.ts
  PETITO_URL=http://localhost:3000 SUPABASE_URL=<supabase url> pytest tests/test_api.py
  ```
- `npx tsx scripts/render-fixtures.ts <photo.jpg> <outdir>` renders every slide type for every theme.

## Notes
- All tables have row-level security on with no policies: the browser never talks to the database;
  every query goes through the API with the service-role key and explicit ownership checks.
- Media is private in Storage and served through `/api/media/{owner}/{name}` (same URLs as before, so
  shared links keep working). Paid assets are protected by unguessable `clean_*` file names, as before.
- Text/vision model: Anthropic by default (`CLAUDE_MODEL`, default `claude-opus-5-5`; `claude-sonnet-5-5` is cheaper).
  Set `OPENAI_API_KEY` and `AI_PROVIDER=openai` to use ChatGPT models instead (`OPENAI_MODEL`, default `gpt-5-mini`).
  Images and videos always use fal.ai.
