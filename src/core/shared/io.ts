import fs from "node:fs/promises";
import path from "node:path";

import { CACHE_VERSION } from "./constants.js";
import { cacheSnapshotSchema } from "./schemas.js";
import type { CacheSnapshot } from "./types.js";
import { getCacheDir } from "./utils.js";

const CACHE_FILE = "models-cache.json";

export async function ensureCacheDir(): Promise<string> {
  const dir = getCacheDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readCacheSnapshot(): Promise<CacheSnapshot | null> {
  try {
    const dir = await ensureCacheDir();
    const raw = await fs.readFile(path.join(dir, CACHE_FILE), "utf8");
    return cacheSnapshotSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeCacheSnapshot(snapshot: Omit<CacheSnapshot, "version"> & { version?: number }): Promise<string> {
  const dir = await ensureCacheDir();
  const fullSnapshot = cacheSnapshotSchema.parse({
    version: snapshot.version ?? CACHE_VERSION,
    ...snapshot,
  });
  const filePath = path.join(dir, CACHE_FILE);
  await fs.writeFile(filePath, `${JSON.stringify(fullSnapshot, null, 2)}\n`, "utf8");
  return filePath;
}
