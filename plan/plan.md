# Petito Plus as the only paywall + go live with real charging

Make Petito Plus the single way to pay: everyone can create and see a free preview, and the
only way to unlock the clean, full version is a Plus subscription. Then switch production to
charge for real.

## Who it's for
The Petito owner, who wants one simple membership (monthly $3.900 / annual $29.900 CLP, auto
renewal) instead of charging per creation, and needs it live and charging on petito.pro.

## What changes (the heart of this task)
Today a free user can pay a one-time fee to unlock each creation (HD portrait $2.990, talking
video $2.990, illustrated story $3.990). That goes away completely. The new model:

- **Everyone (free)**: can create and see a **free preview** of each thing —
  watermarked HD portrait, a short/low-res talking video, and a story preview — plus the real
  memories album, within the existing free limits.
- **The clean / full version** (portrait without watermark, full talking video, full story)
  is unlocked **only by being Plus**. There is no per-creation purchase anywhere.
- Every "unlock / download" button that used to open a one-time checkout now leads to the
  **Plus page** ("Hazte Plus") instead.
- **Plus members**: everything unlocked, no per-item payment, plus unlimited pets and
  unlimited Petito reflections, and public album sharing — as already defined.

So the only checkout in the whole app is the Plus subscription.

## Free limits that stay the same
- 1 pet for free users (unlimited with Plus).
- Petito Habla free preview limited to 2 per day.
- 3 Petito reflections per month (unlimited with Plus).
- Real-memories album: unlimited for everyone.

## User flow (free user hitting the paywall)
1. A free user creates, e.g., an HD portrait and sees the watermarked preview.
2. They tap "Download in HD / unlock".
3. Instead of a one-time payment, they land on the **Plus page** with the two plans.
4. They subscribe through Mercado Pago, authorize with their card, and return to "Mi universo"
   with the Plus badge.
5. Now the clean portrait (and every other creation) is unlocked for them, with no per-item
   charge — now and in the future.

## Going live with real charging
The subscription already generates real Mercado Pago checkouts with the owner's production
token. The live site is still in demo/free mode until three production switches are set (by
the owner, in the deploy Secrets panel — production secrets can't be set from code):
- The Mercado Pago production token (`APP_USR-`) — already added.
- The switch that turns on Mercado Pago as the real payment method.
- The switch that turns on real charging (turns off free mode).

After saving those and re-publishing, the site charges for real. The owner then does one real
card test to confirm end-to-end.

## UI/UX feel
No redesign. User-facing copy stays in warm Chilean Spanish with the existing ivory/terracotta
palette. The only visible change is that "unlock this creation for $X" turns into a gentle
invitation to Plus ("Desbloquéalo con Petito Plus"), keeping the emotional, non-pushy tone.

## Phases
- **Phase 1 (now): Subscription-only + go live.** Remove all one-time checkouts (portrait,
  video, story) from the app; route every unlock to the Plus page; keep free previews and the
  current free limits; make sure Plus unlocks all creations. Then confirm the production
  switches and verify the live site is charging for real, and hand over the card-test checklist.
- **Phase 2 (later): Subscriber management.** A screen where the member sees their plan and
  next charge date and can cancel (keeping access until the end of the paid period).
- **Phase 3 (future): Hardening & reminders.** Register the webhook signature secret and
  validate real renewal notifications; send a warm heads-up a few days before each renewal.

## Assumptions
- Monetization is **subscription-only**. One-time per-creation payments are removed entirely
  (backend checkout/pay flows and the buttons that open them).
- Free users keep **free previews** of every creation (watermarked portrait, short low-res
  talking video, story preview) under the current daily/monthly limits; the clean/full version
  requires Plus.
- The Mercado Pago account is **Chile / CLP**.
- The Plus prices and entitlement rules already approved stay the same (monthly $3.900 / annual
  $29.900, unlimited pets/reflections, public album sharing).
- The owner edits the production secrets and re-publishes from the deploy panel; this task
  guides and verifies but does not edit production secrets on their behalf.
- The webhook signature secret stays optional and is deferred to Phase 3; the webhook is still
  secure without it because the server re-checks each payment/subscription with Mercado Pago
  before granting access.
- The real end-to-end charge is tested by the owner with their own card; no automated charge.
