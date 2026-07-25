import { MongoClient, type Collection, type Db } from "mongodb";

import type { AppState } from "./types";

/**
 * Atlas connection. The URI has no database in its path, so the db name is set
 * here. The client is cached on `globalThis` so Next's dev HMR doesn't open a
 * new connection pool on every reload.
 */

const uri = process.env.MONGO_DB_URI ?? process.env.MONGODB_URI;
const DB_NAME = process.env.MONGO_DB_NAME ?? "futureself";
export const PROFILES_COLLECTION = "profiles";

/** An AppState as stored: keyed by the anonymous per-device profile id. */
export type StoredProfile = AppState & {
  _id: string;
  updatedAt: number;
};

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function clientPromise(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGO_DB_URI is not set");
  if (!global.__mongoClientPromise) {
    global.__mongoClientPromise = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8_000,
    }).connect();
  }
  return global.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  return (await clientPromise()).db(DB_NAME);
}

export async function getProfiles(): Promise<Collection<StoredProfile>> {
  return (await getDb()).collection<StoredProfile>(PROFILES_COLLECTION);
}

export const isMongoConfigured = () => Boolean(uri);
