import fs from "node:fs";
import path from "node:path";

const LOCAL_SUPABASE_KEY_MISMATCH = [
  "ローカルSupabaseのkey不一致。supabase status で .env.local を再同期してください。",
  "復旧手順: supabase stop && supabase start",
  "復旧手順: supabase status の anon key / service role key を .env.local に反映してください。",
].join("\n");

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

function resolveEnv(localEnv: Record<string, string>, name: string): string {
  return process.env[name] ?? localEnv[name] ?? "";
}

function isLocalSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function isAuthError(status: number, body: string): boolean {
  return (
    status === 401 ||
    status === 403 ||
    /PGRST301|JWT|jwt|invalid token|JWS/i.test(body)
  );
}

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_SKIP_SUPABASE_PREFLIGHT === "1") {
    return;
  }

  const localEnv = readEnvFile(path.resolve(process.cwd(), ".env.local"));
  const supabaseUrl = resolveEnv(localEnv, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = resolveEnv(localEnv, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!isLocalSupabaseUrl(supabaseUrl)) {
    return;
  }

  if (!anonKey || anonKey === "test-anon-key") {
    throw new Error(LOCAL_SUPABASE_KEY_MISMATCH);
  }

  const probeUrl = new URL("/rest/v1/", supabaseUrl);
  let response: Response;
  try {
    response = await fetch(probeUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
  } catch (error) {
    throw new Error(
      [
        "ローカルSupabaseに接続できません。supabase start を実行してください。",
        error instanceof Error ? error.message : String(error),
      ].join("\n"),
    );
  }

  const body = await response.text();
  if (response.ok) {
    return;
  }

  if (isAuthError(response.status, body)) {
    throw new Error(`${LOCAL_SUPABASE_KEY_MISMATCH}\nstatus=${response.status}`);
  }

  throw new Error(
    [
      "ローカルSupabaseのプリフライトクエリに失敗しました。",
      `status=${response.status}`,
      body.slice(0, 300),
    ].join("\n"),
  );
}
