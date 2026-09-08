import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Converter } from "opencc-js";

const name = "whale-voice";
const inject = [];
const ROUTE = "/plugins/dsh-whale-voice/config.json";
const PREPARE_ROUTE = "/plugins/dsh-whale-voice/prepare.json";
const TRANSCRIBE_ROUTE = "/plugins/dsh-whale-voice/transcribe.json";
const CONFIG_PATH = process.env.DSH_WHALE_VOICE_FILE || join(homedir(), ".dsh", "whale-voice", "config.json");
const LEGACY_PATH = process.env.APPDATA ? join(process.env.APPDATA, "dsh-whale-chan-client", "whale-voice.json") : "";
const MODELS = ["onnx-community/whisper-tiny", "onnx-community/whisper-base", "onnx-community/whisper-small"];
const LANGUAGES = ["auto", "zh", "en", "ja", "ko"];
const DEVICES = ["cpu", "wasm", "gpu"];
const DEFAULT_CONFIG = Object.freeze({ model: MODELS[0], language: "zh", device: "cpu", cacheDir: "", microphoneId: "", simplifyChinese: true, micIcon: "" });
const LANGUAGE_NAMES = { auto: undefined, zh: "chinese", en: "english", ja: "japanese", ko: "korean" };
const toSimplifiedChinese = Converter({ from: "tw", to: "cn" });
let pipelinePromise = null;
let pipelineKey = "";

function normalizeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const icon = typeof source.micIcon === "string" ? source.micIcon : "";
  return {
    model: MODELS.includes(source.model) ? source.model : DEFAULT_CONFIG.model,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    device: DEVICES.includes(source.device) ? source.device : DEFAULT_CONFIG.device,
    cacheDir: typeof source.cacheDir === "string" ? source.cacheDir.trim().slice(0, 1000) : "",
    microphoneId: typeof source.microphoneId === "string" ? source.microphoneId.slice(0, 500) : "",
    simplifyChinese: source.simplifyChinese !== false,
    // Keep the icon self-contained and prevent arbitrary URL schemes from being
    // injected into the client. 256 KiB is ample for a 32 px button asset.
    micIcon: /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(icon) && icon.length <= 350000 ? icon : ""
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

async function readBody(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

function isLoopback(req) {
  const address = req.socket?.remoteAddress;
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function cacheDir(config) {
  return config.cacheDir || join(homedir(), ".dsh", "whale-voice", "models");
}

async function getPipeline(config) {
  const key = `${config.model}\0${config.device}\0${cacheDir(config)}`;
  if (pipelinePromise && pipelineKey === key) return pipelinePromise;
  pipelineKey = key;
  pipelinePromise = (async () => {
    const transformers = await import("@huggingface/transformers");
    transformers.env.cacheDir = cacheDir(config);
    try { return await transformers.pipeline("automatic-speech-recognition", config.model, { device: config.device }); }
    catch { return transformers.pipeline("automatic-speech-recognition", config.model, { device: "cpu" }); }
  })();
  try { return await pipelinePromise; }
  catch (error) { pipelinePromise = null; pipelineKey = ""; throw error; }
}

async function transcribe(samples) {
  if (!Array.isArray(samples) || samples.length < 1600 || samples.length > 960000) throw new Error("invalid PCM audio");
  const config = await readConfig();
  const pcm = Float32Array.from(samples, (sample) => Number.isFinite(Number(sample)) ? Math.max(-1, Math.min(1, Number(sample))) : 0);
  const pipe = await getPipeline(config);
  const output = await pipe(pcm, { language: LANGUAGE_NAMES[config.language], task: "transcribe", return_timestamps: false });
  const raw = String(output?.text || output?.[0]?.text || "").trim();
  const text = config.language === "zh" && config.simplifyChinese !== false ? toSimplifiedChinese(raw) : raw;
  return { text };
}

function createHandler() {
  return async (req, res) => {
    try {
      if (!isLoopback(req)) return json(res, 403, { ok: false, error: "loopback only" });
      if (req.method === "GET" || req.method === "HEAD") return json(res, 200, { config: await readConfig(), models: MODELS, languages: LANGUAGES, devices: DEVICES });
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

function createPrepareHandler() {
  return async (req, res) => {
    try {
      if (!isLoopback(req) || req.method !== "POST") return json(res, 405, { ok: false, error: "POST from loopback required" });
      await getPipeline(await readConfig());
      return json(res, 200, { ok: true });
    } catch (error) { return json(res, 500, { ok: false, error: String(error?.message || error) }); }
  };
}

function createTranscribeHandler() {
  return async (req, res) => {
    try {
      if (!isLoopback(req) || req.method !== "POST") return json(res, 405, { ok: false, error: "POST from loopback required" });
      const body = await readBody(req, 12 * 1024 * 1024);
      return json(res, 200, { ok: true, ...(await transcribe(body.samples)) });
    } catch (error) { return json(res, 500, { ok: false, error: String(error?.message || error) }); }
  };
}

function apply(ctx) {
  ctx.effect(() => {
    const handler = createHandler();
    const prepareHandler = createPrepareHandler();
    const transcribeHandler = createTranscribeHandler();
    let disposed = false;
    let routeDisposer = null;
    let attempts = 0;
    const tryRegister = () => {
      if (disposed) return true;
      let webServer = null;
      try { webServer = typeof ctx.get === "function" ? ctx.get("webServer") : null; } catch {}
      try { webServer ||= ctx.webServer || null; } catch {}
      if (!webServer || typeof webServer.register !== "function") return false;
      routeDisposer = [
        webServer.register({ kind: "exact", path: ROUTE, handler }),
        webServer.register({ kind: "exact", path: PREPARE_ROUTE, handler: prepareHandler }),
        webServer.register({ kind: "exact", path: TRANSCRIBE_ROUTE, handler: transcribeHandler })
      ];
      return true;
    };
    const timer = tryRegister() ? null : setInterval(() => {
      attempts += 1;
      if (tryRegister() || attempts >= 20) clearInterval(timer);
    }, 500);
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      for (const dispose of routeDisposer || []) try { dispose?.(); } catch {}
    };
  }, "whale-voice: shared config route");
}

const plugin = { apply, inject, name };
export { CONFIG_PATH, DEFAULT_CONFIG, DEVICES, LANGUAGES, MODELS, apply, inject, name, normalizeConfig, transcribe };
export default plugin;
