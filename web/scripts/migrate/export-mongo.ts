/** Step 1: dump every legacy MongoDB collection to scripts/migrate/out/<collection>.ndjson. */
import { MongoClient } from "mongodb";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { COLLECTIONS, OUT, need } from "./shared";

(async () => {
  const client = new MongoClient(need("MONGO_URL"));
  await client.connect();
  const db = client.db(need("DB_NAME"));
  for (const { mongo } of COLLECTIONS) {
    const out = createWriteStream(path.join(OUT, `${mongo}.ndjson`));
    let n = 0;
    for await (const doc of db.collection(mongo).find({}, { projection: { _id: 0 } })) {
      out.write(JSON.stringify(doc) + "\n");
      n++;
    }
    out.end();
    console.log(`${mongo}: ${n}`);
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
