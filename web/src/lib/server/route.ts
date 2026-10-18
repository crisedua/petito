/** Typed helper for dynamic-segment route handlers (Next passes params as a Promise). */
export type Ctx<P extends Record<string, string>> = { params: Promise<P> };
