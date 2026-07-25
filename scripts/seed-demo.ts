/**
 * Pushes the 365-day demo profile straight into MongoDB.
 *
 *   node scripts/seed-demo.ts                 # seeds the fixed demo id
 *   node scripts/seed-demo.ts --id <uuid>     # seeds a specific device's id
 *   node scripts/seed-demo.ts --show          # prints what's stored, changes nothing
 *   node scripts/seed-demo.ts --delete        # removes the demo document
 *
 * The app itself has no seeding UI — this is the only way in, so demo data can
 * never appear on a real user's device by accident.
 *
 * To view it in the app: open /caregiver?id=<the id printed below>. To make a
 * phone show it as its own profile, set the id in the browser console:
 *   localStorage.setItem("futureself:profileId", JSON.stringify("<id>"))
 * then reload — the app pulls the document down on next load.
 */

import fs from "node:fs";

import { MongoClient } from "mongodb";

import { buildDemoState } from "../lib/demoSeed.ts";

const DEMO_ID = "demo-365-anchor";
const DB_NAME = process.env.MONGO_DB_NAME ?? "futureself";
const COLLECTION = "profiles";

function loadEnv() {
  // Read .env / .env.local without pulling in a dependency.
  for (const file of [".env", ".env.local"]) {
    let raw: string;
    try {
      raw = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
      if (!match) continue;
      const key = match[1];
      let value = (match[2] ?? "").trim();
      if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const idFlag = args.indexOf("--id");
  const id = idFlag >= 0 ? args[idFlag + 1] : DEMO_ID;
  const show = args.includes("--show");
  const remove = args.includes("--delete");

  const uri = process.env.MONGO_DB_URI ?? process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_DB_URI is not set (looked in the environment, .env and .env.local).");
    process.exit(1);
  }
  if (!id) {
    console.error("--id needs a value.");
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const profiles = client.db(DB_NAME).collection(COLLECTION);

    if (show) {
      const doc = await profiles.findOne({ _id: id as never });
      if (!doc) {
        console.log(`No document with _id "${id}" in ${DB_NAME}.${COLLECTION}.`);
        return;
      }
      console.log(
        JSON.stringify(
          {
            _id: doc._id,
            name: doc.profile?.name,
            cleanDays: doc.cleanDays,
            relapses: doc.relapses,
            diary: doc.diary?.length,
            calls: doc.callHistory?.length,
            updatedAt: doc.updatedAt && new Date(doc.updatedAt).toISOString(),
          },
          null,
          2,
        ),
      );
      return;
    }

    if (remove) {
      const result = await profiles.deleteOne({ _id: id as never });
      console.log(`Deleted ${result.deletedCount} document(s) with _id "${id}".`);
      return;
    }

    const state = buildDemoState();
    await profiles.updateOne(
      { _id: id as never },
      { $set: { ...state, updatedAt: Date.now() } },
      { upsert: true },
    );

    console.log(`Seeded ${DB_NAME}.${COLLECTION}`);
    console.log(`  _id        ${id}`);
    console.log(`  name       ${state.profile.name}`);
    console.log(`  cleanDays  ${state.cleanDays} (${state.relapses} slip)`);
    console.log(`  diary      ${state.diary.length} entries`);
    console.log(`  calls      ${state.callHistory.length} summarised`);
    console.log(``);
    console.log(`Sign in at /login with:`);
    console.log(`  in recovery      ${state.profile.phone}   (${state.profile.name})`);
    console.log(`  supporting them  ${state.profile.caregiverPhone}   (${state.profile.caregiverName})`);
    console.log(``);
    console.log(`Caregiver view:  /caregiver?id=${id}`);
    console.log(`On a device:     localStorage.setItem("futureself:profileId", ${JSON.stringify(JSON.stringify(id))})`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
