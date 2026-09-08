// DeepSeek Harness 桌面客户端（关窗即退出）
// 双击入口 -> 隐藏地启动 `dsh web`（如果端口空闲）-> 用独立 Chrome 应用窗口打开
// 打印的 token URL -> 关掉该窗口就自动停止它启动的 dsh，一并退出。
//
// 依赖：Windows + Node.js >=22.19 + DeepSeek Harness `dsh web` 可用 + Chrome/Edge。
// 可用环境变量覆盖：
//   DSH_CLIENT_NODE   node.exe 路径（默认走 PATH 里的 node）
//   DSH_CLIENT_DSH    dsh 的 lib/bin.js 绝对路径（默认自动查找）
//   DSH_CLIENT_CHROME chrome.exe 路径（默认自动查找）
//   DSH_CLIENT_PORT   端口（默认 3080）
//   DSH_CLIENT_WORKSPACE  工作目录（默认系统桌面）
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const sleep = (m) => new Promise((r) => setTimeout(r, m));
const alive = (p) => { try { process.kill(p, 0); return true; } catch { return false; } };
const exists = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };

function findNode() {
  if (process.env.DSH_CLIENT_NODE && exists(process.env.DSH_CLIENT_NODE)) return process.env.DSH_CLIENT_NODE;
  if (process.execPath && /node\.exe$/i.test(process.execPath)) return process.execPath;
  return "node";
}
function findDshBin() {
  const cand = [];
  if (process.env.DSH_CLIENT_DSH) cand.push(process.env.DSH_CLIENT_DSH);
  const npx = path.join(os.homedir(), "AppData", "Local", "npm-cache", "_npx");
  try { for (const h of fs.readdirSync(npx)) cand.push(path.join(npx, h, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js")); } catch {}
  for (const c of cand) if (exists(c)) return c;
  throw new Error("找不到 dsh 启动脚本（@deepseek-ai/dsh/lib/bin.js）。请设置 DSH_CLIENT_DSH。");
}
function findChrome() {
  if (process.env.DSH_CLIENT_CHROME && exists(process.env.DSH_CLIENT_CHROME)) return process.env.DSH_CLIENT_CHROME;
  const base = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA];
  for (const b of base) {
    if (!b) continue;
    for (const sub of [["Google", "Chrome", "Application", "chrome.exe"], ["Microsoft", "Edge", "Application", "msedge.exe"]]) {
      const p = path.join(b, ...sub);
      if (exists(p)) return p;
    }
  }
  throw new Error("找不到 Chrome/Edge。请设置 DSH_CLIENT_CHROME。");
}

const HOST = "127.0.0.1";
const PORT = Number(process.env.DSH_CLIENT_PORT || 3080);
const CWD = process.env.DSH_CLIENT_WORKSPACE || path.join(os.homedir(), "Desktop");
const NODE = findNode();
const DSH = findDshBin();
const CHROME = findChrome();

function killTree(p) {
  try {
    spawnSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"),
      ["/PID", String(p), "/T", "/F"], {});
  } catch {}
}

(async () => {
  try {
    const child = spawn(NODE, [DSH, "web", "--no-open", "--host", HOST, "--port", String(PORT)],
      { cwd: CWD, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let acc = "";
    child.stdout.on("data", (d) => { acc += d; });
    child.stderr.on("data", (d) => { acc += d; });
    const t0 = Date.now();
    let url = null;
    while (Date.now() - t0 < 60000) {
      const m = /dsh\s+web:\s*(\S+)/.exec(acc);
      if (m) { url = m[1]; break; }
      if (child.exitCode !== null) break;
      await sleep(250);
    }
    if (!url) throw new Error("启动 dsh web 超时/失败，或端口 3080 已被其它实例占用。请先停止旧的 dsh。");
    const prof = path.join(os.tmpdir(), "dsh-client-" + Date.now());
    fs.mkdirSync(prof, { recursive: true });
    const win = spawn(CHROME, ["--app=" + url, "--user-data-dir=" + prof, "--no-first-run", "--disable-background-mode"],
      { stdio: "ignore" });
    // 等待窗口进程退出 -> 停掉这个客户端启动的 dsh
    while (alive(child.pid)) {
      if (!alive(win.pid)) { killTree(child.pid); break; }
      await sleep(500);
    }
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
    process.exit(0);
  } catch (e) {
    try { console.error("DeepSeek 客户端错误: " + e.message); } catch {}
    process.exit(1);
  }
})();
