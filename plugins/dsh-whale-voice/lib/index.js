import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const name = "whale-voice";
const inject = [];
const ROUTE = "/plugins/dsh-whale-voice/config.json";
const CONFIG_PATH = process.env.DSH_WHALE_VOICE_FILE || join(homedir(), ".dsh", "whale-voice", "config.json");
const LEGACY_PATH = process.env.APPDATA ? join(process.env.APPDATA, "dsh-whale-chan-client", "whale-voice.json") : "";
const MODELS = ["onnx-community/whisper-tiny", "onnx-community/whisper-base", "onnx-community/whisper-small"];
const LANGUAGES = ["auto", "zh", "en", "ja", "ko"];
const DEVICES = ["cpu", "wasm", "gpu"];
const DEFAULT_CONFIG = Object.freeze({ model: MODELS[0], language: "zh", device: "cpu", cacheDir: "" });

function normalizeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    model: MODELS.includes(source.model) ? source.model : DEFAULT_CONFIG.model,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    device: DEVICES.includes(source.device) ? source.device : DEFAULT_CONFIG.device,
    cacheDir: typeof source.cacheDir === "string" ? source.cacheDir.trim().slice(0, 1000) : ""
  };
}

async function readConfig() {
  try { return normalizeConfig(JSON.parse(await readFile(CONFIG_PATH, "utf8"))); }
  catch {
    if (LEGACY_PATH) {
      try {
        const migrated = normalizeConfig(JSON.parse(await readFile(LEGACY_PATH, "utf8")));
        await saveConfig(migrated);
        return migrated;
      } catch {}
    }
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(config) {
  const value = normalizeConfig(config);
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const temp = `${CONFIG_PATH}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temp, CONFIG_PATH);
  return value;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

function createHandler() {
  return async (req, res) => {
    try {
      if (req.method === "GET" || req.method === "HEAD") return json(res, 200, { config: await readConfig(), dataPath: CONFIG_PATH, models: MODELS, languages: LANGUAGES, devices: DEVICES });
      if (req.method === "PUT" || req.method === "POST") {
        const body = await readBody(req);
        return json(res, 200, { ok: true, config: await saveConfig(body.config ?? body), dataPath: CONFIG_PATH });
      }
      return json(res, 405, { ok: false, error: "method not allowed" });
    } catch (error) {
      return json(res, 500, { ok: false, error: String(error?.message || error) });
    }
  };
}

function apply(ctx) {
  ctx.effect(() => {
    const handler = createHandler();
    let disposed = false;
    let routeDisposer = null;
    let attempts = 0;
    const tryRegister = () => {
      if (disposed) return true;
      let webServer = null;
      try { webServer = typeof ctx.get === "function" ? ctx.get("webServer") : null; } catch {}
      try { webServer ||= ctx.webServer || null; } catch {}
      if (!webServer || typeof webServer.register !== "function") return false;
      routeDisposer = webServer.register({ kind: "exact", path: ROUTE, handler });
      return true;
    };
    const timer = tryRegister() ? null : setInterval(() => {
      attempts += 1;
      if (tryRegister() || attempts >= 20) clearInterval(timer);
    }, 500);
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      try { routeDisposer?.(); } catch {}
    };
  }, "whale-voice: shared config route");
}

const plugin = { apply, inject, name };
export { CONFIG_PATH, DEFAULT_CONFIG, DEVICES, LANGUAGES, MODELS, apply, inject, name, normalizeConfig };
export default plugin;
