/** Step 4: compare row counts with the dump and spot-check media objects. */
import path from "node:path";
import { COLLECTIONS, OUT, readNdjson, supabase } from "./shared";

const sb = supabase();
(async () => {
  let ok = true;
  for (const { mongo, table } of COLLECTIONS) {
    let n = 0;
    for await (const _ of readNdjson(path.join(OUT, `${mongo}.ndjson`))) n++;
    const { count } = await sb.from(table).select("*", { count: "exact", head: true });
    const flag = count === n ? "ok" : "DIFF";
    if (flag !== "ok") ok = false;
    console.log(`${table.padEnd(18)} mongo=${String(n).padStart(6)} postgres=${String(count).padStart(6)} ${flag}`);
  }
  const { data: pets } = await sb.from("pets").select("id, photo_file").not("photo_file", "is", null).limit(20);
  let found = 0;
  for (const p of pets ?? []) {
    const { data } = await sb.storage.from("media").list(p.id, { search: p.photo_file });
    if (data?.some((o) => o.name === p.photo_file)) found++;
  }
  console.log(`pet photos present: ${found}/${pets?.length ?? 0}`);
  const { count: unlinked } = await sb.from("app_users").select("*", { count: "exact", head: true }).is("auth_user_id", null);
  console.log(`users not yet linked to Google (expected until their first login): ${unlinked}`);
  console.log("(differences usually mean orphans or duplicate emails — see out/orphans.json)");
  process.exit(ok ? 0 : 1);
})();
