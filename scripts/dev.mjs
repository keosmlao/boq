import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import process from "node:process";

const cwd = process.cwd();
const port = String(process.env.PORT || "3003");
const nextBin = `${cwd}/node_modules/.bin/next`;
const distDirs = [".next", ".next-dev"];

function runCapture(command, args) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function listProcesses() {
  const output = runCapture("ps", ["-axo", "pid=,ppid=,command="]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) return null;
      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        command: match[3],
      };
    })
    .filter(Boolean);
}

function getProjectNextPids() {
  const processes = listProcesses();
  const rootPids = new Set(
    processes
      .filter((proc) => proc.command.includes(nextBin))
      .map((proc) => proc.pid)
  );

  if (!rootPids.size) {
    return [];
  }

  const allPids = new Set(rootPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const proc of processes) {
      if (allPids.has(proc.ppid) && !allPids.has(proc.pid)) {
        allPids.add(proc.pid);
        changed = true;
      }
    }
  }

  return [...allPids];
}

function waitForProjectProcessesToClose(timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getProjectNextPids().length === 0) {
      return true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
  }
  return getProjectNextPids().length === 0;
}

for (const pid of getProjectNextPids()) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
}

waitForProjectProcessesToClose();
for (const dir of distDirs) {
  rmSync(dir, { recursive: true, force: true });
}

const child = spawn(
  process.platform === "win32" ? "next.cmd" : "next",
  ["dev", "-H", "0.0.0.0", "-p", port],
  {
    cwd,
    stdio: "inherit",
    env: process.env,
  }
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
