/**
 * Recreates the fixed rows the legacy HTTP test-suites (backend/tests/*.py) reference by id/slug
 * (they were rows in the old preview database). Local/preview only; idempotent.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(__dirname, "..", ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const now = new Date().toISOString();
const up = async (table: string, rows: any[], onConflict = "id") => {
  const { error } = await sb.from(table).upsert(rows, { onConflict, defaultToNull: false });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length}`);
};

(async () => {
  await up("app_users", [
    { user_id: "user_testnorm1", email: "test.petito.norm@example.com", name: "Test Norm", created_at: now },
    { user_id: "user_testadmin1", email: "eduardo@eduescalante.com", name: "Eduardo", created_at: now },
  ], "user_id");
  await up("pets", [{
    id: "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a", share_slug: "cb6f60b6c6", user_id: "user_testnorm1", name: "Rocco",
    species: "perro", personality: ["regalon"], public_enabled: true, intro_text: "Rocco llegó para llenar de cariño cada día. 🐾", created_at: now,
  }]);
  await up("memories", [{
    id: "f1x7ure0-memo-0000-0000-00000000r0cc", pet_id: "a8f1f1bb-e5ef-4854-b07e-dc438112bd4a", user_id: "user_testnorm1",
    title: "El día que llegó", feeling_text: "Llegó en una caja y se durmió al tiro.", emotions: ["ternura"], created_at: now, updated_at: now,
  }]);
  // The preview server's test user had Plus (needed to create more than one pet).
  await up("subscriptions", [{
    mp_id: "courtesy-fixture-norm", user_id: "user_testnorm1", plan: "monthly", status: "authorized", membership_active: true,
    plus_until: "2036-01-01T00:00:00Z", courtesy: true, created_at: now,
  }], "mp_id");
  await up("portraits", [
    { id: "696bde13-d0d5-488b-8848-e0706c2ae79c", share_slug: "39f1974e10", user_id: "user_testnorm1", pet_name: "Michi", style: "renacentista",
      category: "royal", status: "preview_ready", preview_file: "preview.jpg", clean_file: "clean_fixture00000000.jpg", created_at: now },
    { id: "f1x7ure0-memo-0000-0000-000000000001", share_slug: "3ce2c387ce", user_id: "user_testnorm1", pet_name: "Luna", style: "acuarela",
      category: "memorial", status: "preview_ready", memorial_dates: "2010 – 2024", memorial_caption: "Siempre conmigo", preview_file: "preview.jpg", created_at: now },
  ]);
  await up("videos", [
    { id: "f1x7ure0-talk-0000-0000-000000000001", share_slug: "0de2b4b5f5", mode: "preview_free", status: "preview_ready", preview_file: "preview.mp4", line: "¡Hola!", created_at: now },
    { id: "f1x7ure0-talk-0000-0000-000000000002", share_slug: "23fd33ad28", user_id: "user_testnorm1", mode: "full", status: "preview_ready", preview_file: "preview.mp4", line: "¡Hola humano!", pet_name: "Rocky", created_at: now },
    { id: "f1x7ure0-talk-0000-0000-000000000003", share_slug: "f306f4d403", mode: "preview_free", status: "preview_ready", preview_file: "preview.mp4", line: "¡Hola!", created_at: now },
  ]);
})().catch((e) => { console.error(e); process.exit(1); });
