import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const workspace = process.cwd();
const finalRivePath = join(workspace, "public", "animations", "home-envelope-open.riv");
const mcpUrl = "http://127.0.0.1:9791/mcp";

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findCommand(command) {
  const shell = process.platform === "win32" ? "where.exe" : "which";

  try {
    const { stdout } = await execFileAsync(shell, [command], {
      timeout: 4000,
      windowsHide: true,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function findRiveProcess() {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-Process | Where-Object { $_.ProcessName -match '(^|[^a-z])rive([^a-z]|$)' } | Select-Object -ExpandProperty ProcessName",
      ],
      {
        timeout: 5000,
        windowsHide: true,
      },
    );

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function checkLocalMcp() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(mcpUrl, {
      signal: controller.signal,
    });

    return {
      reachable: true,
      status: response.status,
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const [finalExists, commands, processes, mcp] = await Promise.all([
  fileExists(finalRivePath),
  findCommand("rive"),
  findRiveProcess(),
  checkLocalMcp(),
]);
const finalFile = finalExists ? await stat(finalRivePath) : null;
const summary = {
  finalRuntime: {
    path: "public/animations/home-envelope-open.riv",
    exists: finalExists,
    bytes: finalFile?.size ?? null,
  },
  localAuthoring: {
    riveCommandPaths: commands,
    riveProcesses: processes,
    mcpUrl,
    mcp,
  },
  nextAction:
    finalExists
      ? "Run npm run check:rive-envelope."
      : mcp.reachable
        ? "Use the connected Rive Editor/MCP to export public/animations/home-envelope-open.riv."
        : "Open Rive Editor or use Rive AI Agent with artifacts/home-envelope-rive-handoff.zip, then export public/animations/home-envelope-open.riv.",
};

console.log(JSON.stringify(summary, null, 2));

if (!finalExists) {
  process.exitCode = 1;
}
