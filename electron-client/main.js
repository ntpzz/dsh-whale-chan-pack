// 鲸鱼娘 DSH 桌面客户端 (Electron)
// - 隐藏地启动 `dsh web`（如果端口空闲）
// - 用带鲸鱼娘图标的窗口打开其打印的 token URL
// - 关闭窗口 => 停掉这个客户端启动的 dsh 并退出
// - 轻量：页面内注入一条 “大肥鱼吃了 ~N token · ≈¥X” 估算提示
const { app, BrowserWindow, session, ipcMain, dialog } = require("electron");
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
let shuttingDown = false;

// DSH writes a committed, append-only session log.  Do not immediately use
// taskkill on a normal window close: give the child a chance to flush its last
// batch first, then retain a short forced-stop fallback for a stuck process.
async function stopServerGracefully() {
  const child = server;
  if (!child || child.exitCode !== null) return;
  const done = new Promise((resolve) => child.once("exit", resolve));
  try { child.kill("SIGTERM"); } catch {}
  await Promise.race([done, sleep(5000)]);
  if (child.exitCode === null && serverPid) killTree(serverPid);
  server = null;
  serverPid = null;
}

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

          // —— 2) 语音输入：本地 Whisper(离线，首次下载模型可选) ——
          var WV = window.whaleVoice;
          var mic = { listening:false, ctx:null, src:null, sp:null, buf:[], stream:null, modelChosen:false };
          function editableEl(){
            return document.querySelector('[contenteditable="true"][role="textbox"], [contenteditable="true"][data-lexical-editor], [contenteditable="true"]')
              || document.querySelector('textarea[role="textbox"], textarea') || null;
          }
          function fill(text){
            var el = editableEl(); if (!el) return;
            try {
              el.focus();
              if (el.isContentEditable) document.execCommand('insertText', false, ' ' + text);
              else { var cur = el.value || ''; el.value = cur ? cur.replace(/\s+$/,'') + ' ' + text : text; el.dispatchEvent(new Event('input',{bubbles:true})); }
            } catch(e){ try { el.value = text; el.dispatchEvent(new Event('input',{bubbles:true})); } catch(_){} }
          }
          function micBtnText(b, s){ b.textContent = s; }
          function setStatus(b, msg){ if (b) b.title = msg || '语音输入'; }
          function resample16k(flat, sr, cb){
            try {
              var total = Math.ceil(flat.length / sr * 16000);
              var oac = new OfflineAudioContext(1, total, 16000);
              var ob = oac.createBuffer(1, flat.length, sr);
              ob.copyToChannel(flat, 0);
              var osrc = oac.createBufferSource(); osrc.buffer = ob; osrc.connect(oac.destination); osrc.start(0);
              oac.startRendering().then(function(r){ cb(r.getChannelData(0)); }).catch(function(){ cb(null); });
            } catch(e){ cb(null); }
          }
          function stopRecord(b){
            try { if (mic.sp) mic.sp.disconnect(); if (mic.src) mic.src.disconnect(); if (mic.stream) mic.stream.getTracks().forEach(function(t){t.stop();}); if (mic.ctx) mic.ctx.close(); } catch(e){}
            var sr = mic.ctx ? mic.ctx.sampleRate : 16000;
            var flat = [];
            for (var i=0;i<mic.buf.length;i++){ var c=mic.buf[i]; for(var j=0;j<c.length;j++) flat.push(c[j]); }
            mic.listening=false; micBtnText(b,'⏳'); setStatus(b,'正在识别…');
            resample16k(Float32Array.from(flat), sr, function(pcm){
              if (!pcm) { micBtnText(b,'🎤'); setStatus(b,'识别失败(音频解析)'); return; }
              WV.transcribe(pcm).then(function(r){
                micBtnText(b,'🎤');
                if (r && r.text) fill(r.text);
                else setStatus(b, '没识别到内容');
              }).catch(function(e){ micBtnText(b,'🎤'); setStatus(b,'识别出错'); });
            });
            mic.buf = [];
          }
          function startRecord(b){
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream){
              var AC = window.AudioContext || window.webkitAudioContext;
              var ctx = new AC();
              var src = ctx.createMediaStreamSource(stream);
              var sp = ctx.createScriptProcessor(4096, 1, 1);
              sp.onaudioprocess = function(ev){ mic.buf.push(new Float32Array(ev.inputBuffer.getChannelData(0))); };
              src.connect(sp); sp.connect(ctx.destination);
              mic.ctx=ctx; mic.src=src; mic.sp=sp; mic.stream=stream;
              mic.listening=true; micBtnText(b,'⏹'); setStatus(b,'正在听，再说一次停止');
            }).catch(function(){ micBtnText(b,'🎤'); setStatus(b,'麦克风不可用'); });
          }
          function askModelFirst(b){
            // 首次：弹一个小面板让用户选模型再下载
            var host = (b.closest('[class*="composer"], [class*="Composer"], form') || b.parentElement || document.body);
            var panel = document.createElement('div');
            panel.style.cssText = 'position:absolute;bottom:48px;right:0;z-index:999999;background:'+getComputedStyle(document.body).backgroundColor+';color:'+getComputedStyle(document.body).color+';border:1px solid rgba(128,128,128,.4);border-radius:10px;padding:10px;font-size:13px;width:230px;box-shadow:0 4px 16px rgba(0,0,0,.2);';
            var lab = document.createElement('div'); lab.textContent = '选择 Whisper 模型(首次下载)：'; panel.appendChild(lab);
            var sel = document.createElement('select');
            sel.innerHTML = '<option value="onnx-community/whisper-tiny">tiny 最小 ≈40MB (推荐)</option><option value="onnx-community/whisper-base">base ≈150MB</option>';
            panel.appendChild(sel);
            var langRow = document.createElement('div'); langRow.textContent = '语言：'; panel.appendChild(langRow);
            var lang = document.createElement('select');
            lang.innerHTML = '<option value="auto">自动判断</option><option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ko">한국어</option>';
            panel.appendChild(lang);
            var ok = document.createElement('button'); ok.textContent = '开始下载并启用'; ok.style.cssText='margin-top:8px;padding:4px 10px;';
            ok.onclick = function(){
              WV.setSettings({ model: sel.value, language: lang.value }).then(function(){
                mic.modelChosen = true;
                if (panel.parentNode) panel.parentNode.removeChild(panel);
                startRecord(b);
              });
            };
            panel.appendChild(ok);
            (host.style.position === 'static' ? host : document.body).appendChild(panel);
          }
          function attachMic(){
            if (!WV){ console.log('[voice] whaleVoice 未暴露, typeof=', typeof window.whaleVoice); return; }
            if (document.querySelector('[data-whale-mic]')) return; // 已存在则跳过(重渲染后被移除会自动补回)
            var el = editableEl(); if (!el) return;
            var host = (el.closest('form, [class*="composer"], [class*="Composer"], [role="toolbar"]')) || el.parentElement;
            if (!host) return;
            var send = null;
            var btns = host.querySelectorAll('button, [role="button"]');
            for (var i = 0; i < btns.length; i++) {
              var x = btns[i];
              var ll = (((x.getAttribute && (x.getAttribute('aria-label') || '')) || '') + ' ' + (x.textContent || '')).toLowerCase();
              if (ll.indexOf('send') >= 0 || ll.indexOf('发送') >= 0) { send = x; }
            }
            if (!send && btns.length) send = btns[btns.length - 1];
            var b = document.createElement('button');
            b.type='button'; b.title='语音输入(本地)'; b.textContent='🎤';
            b.style.cssText='margin:0 4px;align-self:center;width:30px;height:30px;border-radius:50%;border:1px solid rgba(128,128,128,.4);background:transparent;cursor:pointer;font-size:15px;flex:0 0 auto;z-index:99999;position:relative;';
            b.onclick = function(){
              if (mic.listening) { stopRecord(b); return; }
              WV.getSettings().then(function(s){
                if (!s || !s.model) { askModelFirst(b); return; }
                if (!mic.modelChosen) mic.modelChosen = true;
                startRecord(b);
              }).catch(function(){ startRecord(b); });
            };
            WV.onStatus(function(msg){ if (msg) setStatus(b, msg); });
            b.setAttribute('data-whale-mic', '1');
            try { if (send && send.parentNode) send.parentNode.insertBefore(b, send); else host.appendChild(b); } catch(e){}
          }
          if (WV) { attachMic(); setInterval(attachMic, 1200); }
        } catch(e){}
      })();
    `;
    win.webContents.executeJavaScript(js).catch(() => {});
  });
}

// ---------- 本地 Whisper 语音(离线) ----------
const VOICE_DEFAULTS = { model: "onnx-community/whisper-tiny", language: "zh", device: "cpu", cacheDir: "" };
const LANG_MAP = { auto: undefined, zh: "chinese", en: "english", ja: "japanese", ko: "korean" };
const VOICE_MODELS = [
  { id: "onnx-community/whisper-tiny", label: "tiny 最小(≈40MB) 默认 · 中文略差" },
  { id: "onnx-community/whisper-base", label: "base(≈150MB) · 中文更准" },
  { id: "onnx-community/whisper-small", label: "small(≈460MB) · 最准但慢" },
];
const VOICE_DEVICES = [
  { id: "cpu", label: "CPU（默认）" },
  { id: "wasm", label: "WASM" },
  { id: "gpu", label: "GPU（需已装 onnxruntime-gpu，否则自动回落 CPU）" },
];
function voicePath() { return process.env.DSH_WHALE_VOICE_FILE || path.join(os.homedir(), ".dsh", "whale-voice", "config.json"); }
function legacyVoicePath() { return path.join(app.getPath("userData"), "whale-voice.json"); }
function loadVoice() {
  try { return Object.assign({}, VOICE_DEFAULTS, JSON.parse(fs.readFileSync(voicePath(), "utf8"))); }
  catch {
    try { const migrated = Object.assign({}, VOICE_DEFAULTS, JSON.parse(fs.readFileSync(legacyVoicePath(), "utf8"))); saveVoice(migrated); return migrated; }
    catch { return { ...VOICE_DEFAULTS }; }
  }
}
function saveVoice(s) { try { fs.mkdirSync(path.dirname(voicePath()), { recursive: true }); fs.writeFileSync(voicePath(), JSON.stringify(s, null, 2) + "\n"); } catch {} }

let _pipe = null;
let _pipeModel = "";
let _pipeCache = "";
let _pipeDevice = "";
async function getWhisper(model) {
  const s = loadVoice();
  if (_pipe && _pipeModel === model && _pipeCache === (s.cacheDir || "") && _pipeDevice === s.device) return _pipe;
  const t = require("@huggingface/transformers");
  if (s.cacheDir) t.env.cacheDir = s.cacheDir;
  try {
    const dev = s.device === "gpu" ? "gpu" : s.device === "wasm" ? "wasm" : "cpu";
    _pipe = await t.pipeline("automatic-speech-recognition", model, { device: dev });
  } catch (e) {
    _pipe = await t.pipeline("automatic-speech-recognition", model); // GPU/WASM 不可用则回落 CPU
  }
  _pipeModel = model;
  _pipeCache = s.cacheDir || "";
  _pipeDevice = s.device;
  return _pipe;
}

app.whenReady().then(async () => {
  // 允许本窗口请求麦克风/摄像头(语音需要 media 权限)
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === "media" || permission === "mediaKeySystem");
  });

  // 语音设置
  ipcMain.handle("whale-settings-get", () => ({ ...loadVoice(), models: VOICE_MODELS, langs: Object.keys(LANG_MAP), devices: VOICE_DEVICES }));
  ipcMain.handle("whale-settings-set", (_e, s) => { const merged = Object.assign(loadVoice(), s || {}); saveVoice(merged); return merged; });
  ipcMain.handle("whale-transcribe", async (e, audio) => {
    const s = loadVoice();
    const win = BrowserWindow.fromWebContents(e.sender);
    const send = (m) => { try { if (win && !win.isDestroyed()) win.webContents.send("whale-status", m); } catch {} };
    send("正在加载/下载模型…(首次约几十 MB，请稍候)");
    let pipe;
    try { pipe = await getWhisper(s.model); }
    catch (err) { send("模型加载失败：" + (err && err.message ? err.message : String(err))); return { text: "", error: String(err) }; }
    send("识别中…");
    const lang = LANG_MAP[s.language];
    const out = await pipe(audio, { language: lang, task: "transcribe", return_timestamps: false });
    send("");
    const text = String(out && out.text ? out.text : (out && out[0] ? out[0].text : "")).trim();
    return { text };
  });

  ipcMain.handle("whale-pick-dir", async () => { const { dialog } = require("electron"); const r = await dialog.showOpenDialog({ properties: ["openDirectory"] }); return r.canceled ? null : (r.filePaths[0] || null); });
  ipcMain.handle("whale-download", async () => { const s = loadVoice(); await getWhisper(s.model); return "ok"; });

  let url;
  try { url = await bootServer(); }
  catch (e) {
    const message = e && e.message ? e.message : String(e);
    console.error("DeepSeek 客户端错误: " + message);
    try { dialog.showErrorBox("DeepSeek Harness 启动失败", message); } catch {}
    app.exit(1);
    return;
  }

  const win = new BrowserWindow({
    width: 1280, height: 860, icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") },
  });
  win.loadURL(url);
  injectUI(win);
  if (process.env.DSH_DEV === "1") win.webContents.openDevTools({ mode: "detach" });
  win.on("close", (event) => {
    if (shuttingDown) return;
    event.preventDefault();
    shuttingDown = true;
    stopServerGracefully().finally(() => { try { win.destroy(); } catch {} app.quit(); });
  });
});

app.on("window-all-closed", () => { app.quit(); });
