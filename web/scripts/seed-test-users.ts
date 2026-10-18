/** Creates the app_users rows behind TEST_SESSION_TOKENS so backend/tests/*.py can authenticate (local/preview only). */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(__dirname, "..", ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pairs = (process.env.TEST_SESSION_TOKENS ?? "").split(",").map((p) => p.split("=").map((s) => s.trim())).filter((p) => p.length === 2);
(async () => {
  for (const [token, email] of pairs) {
    const { data } = await sb.from("app_users").select("user_id").eq("email", email.toLowerCase()).maybeSingle();
    if (!data) await sb.from("app_users").insert({ user_id: `user_${token.replace(/\W/g, "").slice(-12)}`, email: email.toLowerCase(), name: "Test" });
    console.log(`${token} → ${email}`);
  }
})();
