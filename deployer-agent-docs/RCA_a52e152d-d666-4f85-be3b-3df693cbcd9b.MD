# RCA — Petito (cuentapatas-demo / petito.pro) — HTTP 520 on `POST /api/talk/preview`

Active run: `a52e152d-d666-4f85-be3b-3df693cbcd9b` (redeploy, success) · tier_0 "Starter" · arm64 · Cloudflare frontend · cluster deployment-cluster-03

## Problem statement
Uploading a photo in the free "Petito Habla" preview flow (`POST /api/talk/preview`, multipart) returns a Cloudflare **HTTP 520 — "the origin web server sent a response that Cloudflare could not parse."** Only this endpoint is affected; the rest of the site works.

## Confirmed root cause — backend pod is OOMKilled
`get_pod_events` on the active run (kill_findings, verbatim):
- `container ... last terminated: OOMKilled (exit 137) at 2026-10-14T19:45:13Z, restarts=2`
- `event Unhealthy ... Startup probe failed: HTTP probe failed with statuscode: 503`

The backend container is being **OOMKilled (exit 137), and has restarted 2×**. When the Linux OOM killer terminates the uvicorn process mid-request, the in-flight TCP connection to the origin is dropped abruptly — the origin never sends a well-formed HTTP response. Cloudflare sees a reset / unparseable origin response and returns **520**. This is the exact signature of the reported error.

This directly answers the owner's hypothesis: **yes** — the in-process background AI pipeline (Pillow full-res image load + holding fal.ai video bytes in memory) is pushing the single worker past its memory limit and the pod is OOM-killed mid-request, dropping the connection → 520.

## Answers to the 4 specific questions

**1. What did the origin actually return?**
Not a clean HTTP response and not (primarily) a timeout — the process was **killed (OOM, exit 137)** so the connection was severed with no parseable response → CF 520. In the backend access logs (Loki) for `/api/talk/preview` we see `200`, `400` (bad upload) and `429` (app-level rate limit) — but **no 5xx is logged for the failing requests**, which is consistent with the worker being killed before it can emit a response/log line, rather than returning an error.

**2. OOM / restart around request time?**
Confirmed. Container `last_termination.reason = OOMKilled`, `exit_code = 137`, `restart_count = 2`, last kill `2026-10-14T19:45:13Z`, followed by `Startup probe failed: 503` as the pod came back up. This is a repeating OOM→restart cycle, not a one-off.

**3. Production memory limit & worker count (`get_tier`):**
- Tier: `tier_0` "Starter". Memory **request 200Mi, limit 512Mi**. CPU request 50m / limit 250m. **2 replicas** (HPA disabled).
- Workers: there is **no manifest/entrypoint override** staged for this deployment (`get_deployment_manifest entrypoint.sh` → not_found), so the platform-default entrypoint is in effect, which runs a **single uvicorn worker** per pod (no `--workers`/gunicorn). *(Worker count inferred from template default, not from a readable override.)*
- So the entire talk/preview pipeline — FastAPI + the background asyncio task — shares **one 512Mi ceiling** in a single process. A full-res image decode via Pillow plus in-memory fal video bytes comfortably exceeds 512Mi.

**4. Proxy timeout (Cloudflare ~100s)?**
Not the cause. By design `/api/talk/preview` returns `{id, slug}` immediately before the heavy work, and the logs confirm fast `200`s plus a separate later `"... preview ready"` log line. The failure is the OOM connection-drop, not a 100s response-timeout.

## Secondary observations (not the 520 cause)
- App-level rate limiting is returning `429 Too Many Requests` on `/api/talk/preview` (7 seen). Under load users may also hit 429 — separate from the 520.
- The K8s startup/health probe hits `GET /health` which the app returns `404` for (flooding logs). Benign (4xx = server up), but the app exposes no `/health` route.

## Is 512Mi enough? — No.
512Mi is insufficient to run this in-process video pipeline. The OOMKilled/exit-137/restarts=2 evidence proves the pod is hitting the tier memory ceiling during this flow.

## Recommended fixes
1. **User — raise the tier (Resources tab).** OOMKilled is confirmed at the tier_0 512Mi limit, so a memory bump (tier_1/tier_2) is required to run the current in-process pipeline. NOTE: do **not** add more uvicorn workers at low memory — each worker is a full process copy and would increase memory pressure and make OOM worse.
2. **Code (E1) — republish and offload the heavy pipeline.** The owner's code fixes (immediate large-buffer frees, HEIC support, media_base from x-forwarded-host, friendly errors) are **not live yet** — they are only in preview and need a re-publish. More fundamentally, running fal video generation (full-res Pillow + video bytes in RAM) inside the same uvicorn worker is the structural cause; stream media to disk/object storage instead of holding bytes in memory, and/or move the heavy job to a separate worker/queue so a memory spike can't kill the request-serving process. Combine with the tier bump.
