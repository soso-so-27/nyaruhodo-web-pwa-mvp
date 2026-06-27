import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const requiredTables = [
  "cats",
  "collection_photos",
  "cat_moments",
  "cat_moment_deliveries",
  "account_sync_state",
];

const requiredLegalRoutes = [
  "terms",
  "privacy",
  "contact",
  "cancellation",
  "commercial-transactions",
];

const env = {
  ...process.env,
  ...readEnvFile(".env.local"),
};
const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const siteUrl = readEnv("NEXT_PUBLIC_SITE_URL") || readEnv("NEXT_PUBLIC_APP_URL");
const billingEnabled = readEnv("ENABLE_BETA_SUPPORTER_BILLING") === "true";
const localOnly =
  process.argv.includes("--local") || process.argv.includes("--local-only");

console.log("Checking local release configuration...");
requireEnv("NEXT_PUBLIC_SUPABASE_URL");
requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
requireEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
requireEnv("SUPABASE_SERVICE_ROLE_KEY");
requireEnv("BETA_TESTER_EMAILS");

if (!siteUrl) {
  fail("Missing NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL.");
}

if (/localhost|127\.0\.0\.1/.test(siteUrl)) {
  fail(`Release URL must not point to localhost: ${siteUrl}`);
}

if (billingEnabled) {
  requireEnv("STRIPE_SECRET_KEY");
  requireEnv("STRIPE_WEBHOOK_SECRET");
  requireEnv("STRIPE_PRICE_ID_BETA_SUPPORTER");

  const stripeSecret = readEnv("STRIPE_SECRET_KEY");
  if (!stripeSecret.startsWith("sk_live_")) {
    fail("ENABLE_BETA_SUPPORTER_BILLING=true requires a live STRIPE_SECRET_KEY.");
  }

  if (!readEnv("STRIPE_PRICE_ID_BETA_SUPPORTER").startsWith("price_")) {
    fail("STRIPE_PRICE_ID_BETA_SUPPORTER must look like a Stripe price id.");
  }
} else {
  warn("ENABLE_BETA_SUPPORTER_BILLING is not true. Paid supporter checkout is disabled.");
}

console.log("Checking legal routes...");
for (const route of requiredLegalRoutes) {
  requireFile(`src/app/${route}/page.tsx`);
}

console.log("Checking PWA assets...");
requireFile("src/app/manifest.ts");
requireReferencedPublicAssets("src/app/manifest.ts");
requireReferencedPublicAssets("src/app/layout.tsx");

if (localOnly) {
  console.log("Local release readiness checks passed.");
  process.exit(0);
}

console.log("Checking Supabase migrations...");
let migrationOutput = "";
try {
  migrationOutput = execFileSync("supabase", ["migration", "list"], {
    encoding: "utf8",
  });
} catch (error) {
  fail(
    `Could not run 'supabase migration list'. Install/login/link Supabase CLI before beta release. ${
      error instanceof Error ? error.message : ""
    }`,
  );
}

const pendingMigrations = migrationOutput
  .split(/\r?\n/)
  .filter((line) => /^\s*\d{14}\s+\|/.test(line))
  .filter((line) => line.split("|")[1]?.trim() === "");

if (pendingMigrations.length > 0) {
  fail(`Remote database is missing migrations:\n${pendingMigrations.join("\n")}`);
}

console.log("Checking required tables...");
for (const table of requiredTables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (![200, 401].includes(response.status)) {
    const body = await response.text();
    fail(`${table} is not reachable. HTTP ${response.status}: ${body}`);
  }
}

console.log("Checking cat_moments delivery pool is not anon-readable...");
const deliveryPoolResponse = await fetch(
  `${supabaseUrl}/rest/v1/cat_moments?select=id&visibility=eq.shared&delivery_status=eq.available&limit=1`,
  {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  },
);

if (deliveryPoolResponse.status === 200) {
  const rows = await deliveryPoolResponse.json().catch(() => null);

  if (Array.isArray(rows) && rows.length > 0) {
    fail("cat_moments shared delivery pool is readable with the anon key.");
  }
} else if (![401, 403].includes(deliveryPoolResponse.status)) {
  const body = await deliveryPoolResponse.text();
  fail(
    `cat_moments anon delivery-pool check returned unexpected HTTP ${deliveryPoolResponse.status}: ${body}`,
  );
}

console.log("Checking cat-photos storage bucket...");
const bucketResponse = await fetch(`${supabaseUrl}/storage/v1/object/list/cat-photos`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prefix: "", limit: 1, offset: 0 }),
});

if (bucketResponse.status === 200) {
  const objects = await bucketResponse.json().catch(() => null);
  if (Array.isArray(objects) && objects.length > 0) {
    fail("cat-photos bucket can be listed with the anon key.");
  }
  warn("cat-photos bucket returned 200 to anon list. Confirm storage policies before release.");
} else if (![400, 401, 403].includes(bucketResponse.status)) {
  const body = await bucketResponse.text();
  fail(`cat-photos bucket access check returned HTTP ${bucketResponse.status}: ${body}`);
}

console.log("Release readiness checks passed.");

function readEnv(name) {
  return (env[name] ?? "").trim();
}

function requireEnv(name) {
  if (!readEnv(name)) {
    fail(`Missing ${name}.`);
  }
}

function requireFile(path) {
  if (!existsSync(path)) {
    fail(`Missing required file: ${path}`);
  }
}

function requireReferencedPublicAssets(path) {
  requireFile(path);

  const source = readFileSync(path, "utf8");
  const assetPaths = [
    ...source.matchAll(/["'`](\/(?:icons?|splash|favicon)[^"'`)]*)["'`]/g),
  ]
    .map((match) => match[1])
    .filter((value) => !value.startsWith("http"));

  for (const assetPath of assetPaths) {
    const localPath = `public${assetPath}`;
    if (!existsSync(localPath)) {
      fail(`Missing public asset referenced by ${path}: ${assetPath}`);
    }
  }
}

function readEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([^#=]+)=(.*)$/))
        .filter(Boolean)
        .map((match) => [match[1].trim(), match[2].trim()]),
    );
  } catch {
    return {};
  }
}

function warn(message) {
  console.warn(`Warning: ${message}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
