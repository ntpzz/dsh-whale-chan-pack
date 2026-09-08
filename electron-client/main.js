// 鲸鱼娘 DSH 桌面客户端 (Electron)
// - 隐藏地启动 `dsh web`（如果端口空闲）
// - 用带鲸鱼娘图标的窗口打开其打印的 token URL
// - 关闭窗口 => 停掉这个客户端启动的 dsh 并退出
// - 轻量：页面内注入一条 “大肥鱼吃了 ~N token · ≈¥X” 估算提示
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PORT = Number(process.env.DSH_PORT || 3080);
const HOST = "127.0.0.1";
const CWD = process.env.DSH_WORKSPACE || path.join(os.homedir(), "Desktop");
const ICON = path.join(__dirname, "whale.ico");

const exists = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const sleep = (m) => new Promise((r) => setTimeout(r, m));

function nodePath() {
  const p = process.env.DSH_NODE;
  if (p && exists(p)) return p;
  const e = process.env.DSH_NODE_FALLBACK;
  return e && exists(e) ? e : "node";
}
function dshBin() {
  const c = [];
  if (process.env.DSH_BIN && exists(process.env.DSH_BIN)) c.push(process.env.DSH_BIN);
  const npx = path.join(os.homedir(), "AppData", "Local", "npm-cache", "_npx");
  try { for (const h of fs.readdirSync(npx)) c.push(path.join(npx, h, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js")); } catch {}
  for (const x of c) if (exists(x)) return x;
  throw new Error("找不到 dsh bin.js，请设 DSH_BIN");
}
function killTree(pid) { try { require("node:child_process").spawnSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"), ["/PID", String(pid), "/T", "/F"], {}); } catch {} }

let server = null;
let serverPid = null;

async function bootServer() {
  const node = nodePath();
  const dsh = dshBin();
  server = spawn(node, [dsh, "web", "--no-open", "--host", HOST, "--port", String(PORT)], {
    cwd: CWD, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  serverPid = server.pid;
  let acc = "";
  server.stdout.on("data", (d) => { acc += d; });
  server.stderr.on("data", () => {});
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const m = /dsh\s+web:\s*(\S+)/.exec(acc);
    if (m) return m[1];
    if (server.exitCode !== null) throw new Error("dsh web 启动失败");
    await sleep(250);
  }
  throw new Error("等待 dsh web 启动超时");
}

function injectCostPill(win) {
  // 估算当前对话文本量 -> token -> 费用（DeepSeek 近期价，粗略混合）
  win.webContents.on("did-finish-load", () => {
    const js = `
      (function(){
        if (window.__whaleCostPill) return;
        window.__whaleCostPill = true;
        function est(){
          try {
            let chars = 0;
            // 聊天消息体（尽力而为）：统计较长文本节点
            document.querySelectorAll('[class*="message"], [class*="Message"], [role="listitem"]').forEach(function(el){
              const t = el.innerText || "";
              if (t.length > 40) chars += t.length;
            });
            const tokens = Math.max(1, Math.round(chars * 0.5));
            const costYuan = (tokens / 1e6) * 5.0; // ¥/1M 混合估算
            const s = '🐋 大肥鱼吃了 ~' + tokens + ' token · ≈¥' + costYuan.toFixed(2);
            pill.textContent = s;
          } catch(e){}
        }
        const pill = document.createElement('div');
        pill.id = 'whale-cost-pill';
        pill.style.cssText = 'position:fixed;left:12px;bottom:64px;z-index:99999;font-size:12px;padding:4px 10px;border-radius:14px;opacity:.9;pointer-events:none;font-family:inherit;';
        pill.style.color = getComputedStyle(document.body).color;
        pill.style.background = getComputedStyle(document.body).backgroundColor;
        document.body.appendChild(pill);
        setInterval(est, 2000); est();
      })();
    `;
    win.webContents.executeJavaScript(js).catch(() => {});
  });
}

app.whenReady().then(async () => {
  let url;
  try { url = await bootServer(); }
  catch (e) { console.error("DeepSeek 客户端错误: " + e.message); app.exit(1); return; }

  const win = new BrowserWindow({
    width: 1280, height: 860, icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(url);
  injectCostPill(win);
  win.on("closed", () => { if (serverPid) killTree(serverPid); app.quit(); });
  win.on("close", () => { if (serverPid) killTree(serverPid); });
});

app.on("window-all-closed", () => { if (serverPid) killTree(serverPid); app.quit(); });
