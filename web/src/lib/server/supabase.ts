import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "./env";

let service: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Only ever used from route handlers and Inngest functions. */
export function createServiceClient(): SupabaseClient {
  if (!service) {
    service = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return service;
}

/** Cookie-bound client used only to read/refresh the signed-in user's Supabase Auth session. */
export async function createSessionClient() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component render: cookies are read-only there; proxy.ts refreshes them.
        }
      },
    },
  });
}
