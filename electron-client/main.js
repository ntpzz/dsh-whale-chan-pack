// 鲸鱼娘 DSH 桌面客户端 (Electron)
// - 隐藏地启动 `dsh web`（如果端口空闲）
// - 用带鲸鱼娘图标的窗口打开其打印的 token URL
// - 关闭窗口 => 停掉这个客户端启动的 dsh 并退出
// - 轻量：页面内注入一条 “大肥鱼吃了 ~N token · ≈¥X” 估算提示
const { app, BrowserWindow, session } = require("electron");
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
  let errAcc = "";
  server.stdout.on("data", (d) => { acc += d; });
  server.stderr.on("data", (d) => { errAcc += d; });
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const m = /dsh\s+web:\s*(\S+)/.exec(acc);
    if (m) return m[1];
    if (server.exitCode !== null) {
      const tail = errAcc.trim().split(/\r?\n/).slice(-6).join(" | ");
      throw new Error("dsh web 启动失败(退出码 " + server.exitCode + ")：" + (tail || "无输出，多半是端口 3080 已被其它 dsh 占用"));
    }
    await sleep(250);
  }
  throw new Error("等待 dsh web 启动超时");
}

function injectUI(win) {
  // 页面内注入：费用提示(自首次启动累计) + 语音输入(🎤)。全部浏览器端、健壮降级。
  win.webContents.on("did-finish-load", () => {
    const js = `
      (function(){
        try {
          if (window.__whaleUI) return;
          window.__whaleUI = true;
          var LS = function(k,d){ try { return localStorage.getItem(k)===null?d:Number(localStorage.getItem(k)); } catch(e){ return d; } };
          var LSS = function(k,v){ try { localStorage.setItem(k,String(v)); } catch(e){} };

          // —— 1) 费用：大肥鱼偷吃了你 ~N token · ≈¥X（从首次启动起累计，只增不减）
          var pill = document.createElement('div');
          pill.id = 'whale-cost-pill';
          pill.style.cssText = 'position:fixed;left:12px;bottom:64px;z-index:99999;font-size:12px;padding:4px 10px;border-radius:14px;opacity:.92;pointer-events:none;font-family:inherit;';
          pill.style.color = getComputedStyle(document.body).color;
          pill.style.background = getComputedStyle(document.body).backgroundColor;
          var started = LS('whaleCostTokens', 0);
          function est(){
            try {
              var chars = 0;
              document.querySelectorAll('[class*="message"], [class*="Message"], [role="listitem"]').forEach(function(el){
                var t = (el.innerText || '');
                if (t.length > 40) chars += t.length;
              });
              var cur = Math.max(1, Math.round(chars * 0.5));
              // 累计记录：取历史与当前较大值，自首次启动只增不减
              var total = Math.max(started, cur);
              LSS('whaleCostTokens', total);
              var cost = (total / 1e6) * 5.0; // ¥/1M 混合估算(DeepSeek 价)
              pill.textContent = '🐋 大肥鱼偷吃了你 ~' + total + ' token · ≈¥' + cost.toFixed(2);
            } catch(e){}
          }
          (document.body || document.documentElement).appendChild(pill);
          setInterval(est, 2000); est();

          // —— 2) 语音输入：给输入框旁加一个 🎤
          var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          var rec = null, listening = false;
          function editable(){ return document.querySelector('textarea[role="textbox"], textarea') || document.querySelector('[contenteditable="true"]') || null; }
          function setNative(el, text){
            try {
              var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : (el.isContentEditable ? HTMLDivElement.prototype : HTMLInputElement.prototype);
              var set = Object.getOwnPropertyDescriptor(proto, 'value');
              if (set && set.set) set.set.call(el, text);
              el.dispatchEvent(new Event('input', { bubbles: true }));
            } catch(e){ el.value = text; }
          }
          function fill(text){
            var el = editable(); if (!el) return;
            if (el.isContentEditable) { el.textContent = (el.textContent ? el.textContent + ' ' : '') + text; el.dispatchEvent(new Event('input',{bubbles:true})); }
            else { var cur = el.value || ''; setNative(el, (cur ? cur.replace(/\\s+$/,'') + ' ' : '') + text); }
          }
          function attachMic(){
            if (attachMic.done || !SR) return;
            var el = editable(); if (!el) return;
            var host = (el.closest && (el.closest('form, [class*="composer"], [class*="Composer"], [role="toolbar"]'))) || el.parentElement;
            if (!host) return;
            var send = null;
            var btns = host.querySelectorAll('button, [role="button"]');
            for (var i = 0; i < btns.length; i++) {
              var x = btns[i];
              var lab = (((x.getAttribute && (x.getAttribute('aria-label') || '')) || '') + ' ' + (x.textContent || '')).toLowerCase();
              if (lab.indexOf('send') >= 0 || lab.indexOf('发送') >= 0) { send = x; }
            }
            if (!send && btns.length) send = btns[btns.length - 1]; // 退路：最后一个操作键(通常是发送)
            var b = document.createElement('button');
            b.type = 'button'; b.title = '语音输入'; b.textContent = '🎤';
            b.style.cssText = 'margin:0 4px;align-self:center;width:30px;height:30px;border-radius:50%;border:1px solid rgba(128,128,128,.4);background:transparent;cursor:pointer;font-size:15px;flex:0 0 auto;z-index:99999;position:relative;';
            b.onclick = function(){
              if (listening) { try{rec.stop();}catch(e){} return; }
              function begin(){
                try {
                  rec = new SR();
                  rec.lang = (navigator.language||'').indexOf('en')===0 ? 'en-US' : 'zh-CN';
                  rec.interimResults = false;
                  rec.onresult = function(ev){ var t=''; for(var i=ev.resultIndex;i<ev.results.length;i++) t+=ev.results[i][0].transcript; if(t.trim()) fill(t.trim()); };
                  rec.onend = function(){ listening=false; b.textContent='🎤'; };
                  rec.onerror = function(){ listening=false; b.textContent='🎤'; };
                  rec.start(); listening=true; b.textContent='⏹';
                } catch(e){ b.textContent='🎤'; }
              }
              // 先触发一次麦克风授权，再开识别
              if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ audio: true }).then(function(){ begin(); }).catch(function(){ b.textContent='🎤'; });
              } else begin();
            };
            try {
              if (send && send.parentNode) send.parentNode.insertBefore(b, send);
              else host.appendChild(b);
              attachMic.done = true;
            } catch(e){}
          }
          if (SR) { attachMic(); setInterval(attachMic, 1500); }
        } catch(e){}
      })();
    `;
    win.webContents.executeJavaScript(js).catch(() => {});
  });
}

app.whenReady().then(async () => {
  // 允许本窗口请求麦克风/摄像头(语音识别需要 media 权限)
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === "media" || permission === "mediaKeySystem");
  });

  let url;
  try { url = await bootServer(); }
  catch (e) { console.error("DeepSeek 客户端错误: " + e.message); app.exit(1); return; }

  const win = new BrowserWindow({
    width: 1280, height: 860, icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(url);
  injectUI(win);
  win.on("closed", () => { if (serverPid) killTree(serverPid); app.quit(); });
  win.on("close", () => { if (serverPid) killTree(serverPid); });
});

app.on("window-all-closed", () => { if (serverPid) killTree(serverPid); app.quit(); });
