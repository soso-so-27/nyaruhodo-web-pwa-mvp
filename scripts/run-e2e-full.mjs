import { spawn } from "node:child_process";
import path from "node:path";

const playwrightBin =
  process.platform === "win32"
    ? path.join("node_modules", ".bin", "playwright.cmd")
    : path.join("node_modules", ".bin", "playwright");

const child = spawn(playwrightBin, ["test", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    PLAYWRIGHT_REQUIRE_LOCAL_SUPABASE: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
