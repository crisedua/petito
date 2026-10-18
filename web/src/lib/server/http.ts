import { NextResponse } from "next/server";

/** FastAPI-compatible error shape: the ported screens read `err.response.data.detail`. */
export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

export const fail = (status: number, detail: string) => new ApiError(status, detail);

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Wrap a route handler so thrown ApiErrors become `{detail}` responses and anything else is a 500. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return json({ detail: e.detail }, e.status);
      console.error(e);
      return json({ detail: "Algo salió mal" }, 500);
    }
  };
}

export const deviceId = (req: Request) => (req.headers.get("x-device-id") ?? "").trim();

/** Public origin of this deployment (port of server.py `_origin_from`). */
export function originFrom(req: Request): string | null {
  const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  if (origin) return origin;
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  if (base) return base;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host.split(",")[0].trim()}` : null;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export const clip = (s: unknown, n: number): string | null => {
  const t = typeof s === "string" ? s.trim() : "";
  return t ? t.slice(0, n) : null;
};

/** Midnight UTC of today, ISO — the legacy daily rate limits count from here. */
export const dayStartIso = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};
