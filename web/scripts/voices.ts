/**
 * Find Spanish voices for Petipop in ElevenLabs and print the ELEVENLABS_VOICES line to paste into Vercel.
 *
 *   npx tsx scripts/voices.ts mine                 # Spanish voices already in your account
 *   npx tsx scripts/voices.ts search chilean       # shared library: Spanish voices with a Chilean accent
 *   npx tsx scripts/voices.ts search               # shared library: any Spanish accent (Latin American first)
 *   npx tsx scripts/voices.ts add <owner_id> <voice_id> "Nombre"   # copy a library voice into your account
 *
 * Needs ELEVENLABS_API_KEY in web/.env.local. Library voices must be added to your account before use.
 */
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(__dirname, "..", ".env.local") });
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error("Set ELEVENLABS_API_KEY in web/.env.local"); process.exit(1); }
const H = { "xi-api-key": KEY };
const [cmd = "mine", ...args] = process.argv.slice(2);

async function get(url: string) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
const row = (v: any) => `${v.voice_id}  ${String(v.name).padEnd(22)} ${(v.labels?.accent ?? v.accent ?? "").padEnd(14)} ${(v.labels?.gender ?? v.gender ?? "").padEnd(7)} ${v.labels?.age ?? v.age ?? ""}  ${v.preview_url ?? ""}`;
const envLine = (list: any[]) => `\nELEVENLABS_VOICES=${list.slice(0, 4).map((v) => `${v.voice_id}:${v.name}`).join("|")}\n`;

(async () => {
  if (cmd === "mine") {
    const d = await get("https://api.elevenlabs.io/v2/voices?page_size=100&language=es");
    const list = d.voices ?? [];
    console.log(`${list.length} Spanish voices in your account:\n`);
    list.forEach((v: any) => console.log(row(v)));
    if (list.length) console.log("\nPaste into Vercel (first one is the default):", envLine(list));
  } else if (cmd === "search") {
    const accent = args[0];
    const url = new URL("https://api.elevenlabs.io/v1/shared-voices");
    url.searchParams.set("language", "es");
    url.searchParams.set("page_size", "50");
    url.searchParams.set("sort", "usage_character_count_1y");
    if (accent) url.searchParams.set("accent", accent);
    const d = await get(url.toString());
    const list = (d.voices ?? []).filter((v: any) => v.free_users_allowed !== false);
    // Latin American accents first, then everything else
    const latam = /chile|latin|mexic|argent|colomb|peru|neutral|venez|uruguay/i;
    list.sort((a: any, b: any) => Number(latam.test(b.accent)) - Number(latam.test(a.accent)));
    console.log(`${list.length} shared Spanish voices${accent ? ` (accent: ${accent})` : ""}. Listen with the preview URL, then add:\n`);
    list.forEach((v: any) => console.log(`${row(v)}\n   add: npx tsx scripts/voices.ts add ${v.public_owner_id} ${v.voice_id} "${v.name}"`));
  } else if (cmd === "add") {
    const [owner, voiceId, name] = args;
    if (!owner || !voiceId || !name) throw new Error('usage: add <owner_id> <voice_id> "Nombre"');
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${owner}/${voiceId}`, {
      method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ new_name: name }),
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    console.log("added:", await r.json(), `\nnow run: npx tsx scripts/voices.ts mine`);
  } else {
    console.error("commands: mine | search [accent] | add <owner_id> <voice_id> \"Nombre\"");
  }
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
