import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import {
  CAT_PHOTOS_BACKUP_BUCKET,
  runCatPhotosBackup,
} from "../../src/lib/server/storageBackup";
import { CAT_PHOTOS_BUCKET } from "../../src/lib/photoStorage";

const localEnv = readLocalEnv();
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

test.describe("cat photo storage backup", () => {
  test.setTimeout(120_000);

  test.skip(
    !supabaseUrl || !serviceRoleKey || !isLocalSupabaseUrl(supabaseUrl),
    "Local Supabase URL and service role key are required.",
  );

  test("copies new photos and never mirrors production deletions", async () => {
    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await ensureSourceBucket(supabase);

    const objectPath = `e2e/storage-backup/${crypto.randomUUID()}.png`;
    const body = new Uint8Array([137, 80, 78, 71, Date.now() % 255]);

    try {
      const { error: uploadError } = await supabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .upload(objectPath, body, { contentType: "image/png", upsert: true });
      expect(uploadError).toBeNull();

      const firstRun = await runCatPhotosBackup(supabase);
      expect(firstRun.failed).toBe(0);
      expect(firstRun.copied).toBeGreaterThanOrEqual(1);

      const { data: backupData, error: downloadError } = await supabase.storage
        .from(CAT_PHOTOS_BACKUP_BUCKET)
        .download(objectPath);
      expect(downloadError).toBeNull();
      expect(new Uint8Array(await backupData!.arrayBuffer())).toEqual(body);

      const secondRun = await runCatPhotosBackup(supabase);
      expect(secondRun.failed).toBe(0);
      expect(secondRun.skipped).toBeGreaterThanOrEqual(1);

      const { error: sourceDeleteError } = await supabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .remove([objectPath]);
      expect(sourceDeleteError).toBeNull();

      const afterDeleteRun = await runCatPhotosBackup(supabase);
      expect(afterDeleteRun.failed).toBe(0);
      const { data: retainedBackup, error: retainedError } =
        await supabase.storage
          .from(CAT_PHOTOS_BACKUP_BUCKET)
          .download(objectPath);
      expect(retainedError).toBeNull();
      expect(new Uint8Array(await retainedBackup!.arrayBuffer())).toEqual(body);
    } finally {
      await supabase.storage.from(CAT_PHOTOS_BUCKET).remove([objectPath]);
      await supabase.storage
        .from(CAT_PHOTOS_BACKUP_BUCKET)
        .remove([objectPath]);
    }
  });
});

async function ensureSourceBucket(
  supabase: SupabaseClient,
) {
  const { data } = await supabase.storage.getBucket(CAT_PHOTOS_BUCKET);
  if (data) {
    return;
  }
  const { error } = await supabase.storage.createBucket(CAT_PHOTOS_BUCKET, {
    public: false,
  });
  expect(error).toBeNull();
}

function readLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

function isLocalSupabaseUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}
