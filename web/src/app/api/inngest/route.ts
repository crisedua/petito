import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Each invocation runs one or a few steps; slide rendering and media downloads fit comfortably.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
