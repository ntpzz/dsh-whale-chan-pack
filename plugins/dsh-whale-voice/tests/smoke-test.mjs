import assert from "node:assert/strict";
import plugin, { apply, normalizeConfig } from "../lib/index.js";

assert.equal(plugin.apply, apply);
assert.equal(typeof plugin.apply, "function");
assert.deepEqual(normalizeConfig({ model: "bad", language: "bad", device: "bad", cacheDir: 2 }), { model: "onnx-community/whisper-tiny", language: "zh", device: "cpu", cacheDir: "", microphoneId: "", simplifyChinese: true });
assert.deepEqual(normalizeConfig({ model: "onnx-community/whisper-base", language: "en", device: "gpu", cacheDir: "  D:/models  ", microphoneId: "mic-a", simplifyChinese: false }), { model: "onnx-community/whisper-base", language: "en", device: "gpu", cacheDir: "D:/models", microphoneId: "mic-a", simplifyChinese: false });

let cleanup;
const registered = [];
apply({ get(key) { return key === "webServer" ? { register(spec) { registered.push(spec); return () => registered.push("disposed"); } } : null; }, effect(callback) { cleanup = callback(); } });
assert.equal(registered[0].path, "/plugins/dsh-whale-voice/config.json");
cleanup();
assert.equal(registered[1], "disposed");
console.log("dsh-whale-voice smoke tests passed");
