import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Each invocation runs one or a few steps; slide rendering and media downloads fit comfortably.
export const maxDuration = 300;

// Production always registers the public domain: a sync that arrives through another host (the deploy's
// protected alias, an old domain) would otherwise point Inngest somewhere jobs can't reach, and they hang at 5%.
const serveOrigin = process.env.INNGEST_SERVE_ORIGIN || (process.env.VERCEL_ENV === "production" ? "https://www.petipop.pro" : undefined);

export const { GET, POST, PUT } = serve({ client: inngest, functions, serveOrigin });
