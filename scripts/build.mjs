import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import process from "node:process";

const cwd = process.cwd();
rmSync(".next", { recursive: true, force: true });

const child = spawn(
  process.platform === "win32" ? "next.cmd" : "next",
  ["build"],
  {
    cwd,
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: ".next" },
    shell: process.platform === "win32",
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
