window.__ModuleLoader__.load({
  id: "dsh-whale-voice",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const name = "whale-voice";
    const inject = ["slots"];
    const URL = "/plugins/dsh-whale-voice/config.json";

    const LABELS = {
      models: {
        "onnx-community/whisper-tiny": "tiny · 最快，约 40MB",
        "onnx-community/whisper-base": "base · 更准确，约 150MB",
        "onnx-community/whisper-small": "small · 最准确但较慢，约 460MB"
      },
      languages: { auto: "自动判断", zh: "中文（推荐，避免翻译成英文）", en: "English", ja: "日本語", ko: "한국어" },
      devices: { cpu: "CPU（稳定默认）", wasm: "WASM", gpu: "GPU（不可用时自动回落 CPU）" }
    };

    function VoicePanel() {
      const [payload, setPayload] = React.useState(null);
      const [draft, setDraft] = React.useState(null);
      const [status, setStatus] = React.useState("正在读取本地设置…");
      React.useEffect(() => {
        fetch(URL, { cache: "no-store" }).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        }).then((next) => { setPayload(next); setDraft({ ...next.config }); setStatus(""); }).catch((error) => setStatus("语音设置服务不可用：" + String(error?.message || error)));
      }, []);
      const save = async (prepareModel) => {
        try {
          setStatus(prepareModel ? "保存中，正在准备本地模型…" : "正在保存…");
          const response = await fetch(URL, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: draft }) });
          const next = await response.json();
          if (!response.ok) throw new Error(next.error || `HTTP ${response.status}`);
          setDraft({ ...next.config });
          if (window.whaleVoice?.setSettings) await window.whaleVoice.setSettings(next.config);
          if (prepareModel && window.whaleVoice?.download) await window.whaleVoice.download();
          setStatus(prepareModel ? "模型已准备好，设置已生效" : "设置已保存并生效");
        } catch (error) { setStatus("保存失败：" + String(error?.message || error)); }
      };
      if (!payload || !draft) return React.createElement("div", { className: "wv-page" }, status);
      const select = (label, key, options, labels) => React.createElement("label", { className: "wv-field", key }, React.createElement("span", null, label), React.createElement("select", { value: draft[key], onChange: (event) => setDraft({ ...draft, [key]: event.target.value }) }, options.map((value) => React.createElement("option", { value, key: value }, labels[value] || value))));
      const pickDirectory = async () => {
        if (!window.whaleVoice?.pickDir) return setStatus("目录浏览仅在鲸鱼娘 Electron 客户端中可用，可直接输入路径");
        const value = await window.whaleVoice.pickDir();
        if (value) setDraft({ ...draft, cacheDir: value });
      };
      return React.createElement("div", { className: "wv-page" },
        React.createElement("style", null, `.wv-page{max-width:760px;padding:8px 4px 40px;color:#edf3ff}.wv-page h2,.wv-page h3{color:#fff}.wv-group{border:1px solid #536983;border-radius:14px;padding:18px;background:#151e2a}.wv-field{display:flex;flex-direction:column;gap:6px;margin:13px 0;font-size:13px;color:#f2f6ff}.wv-field select,.wv-field input{padding:9px;border:1px solid #627996;border-radius:8px;background:#101722;color:#f7f9ff;color-scheme:dark}.wv-field select option{background:#101722;color:#f7f9ff}.wv-field input::placeholder{color:#afbed3;opacity:1}.wv-field select:focus,.wv-field input:focus{outline:2px solid #73baff;outline-offset:1px}.wv-row{display:flex;gap:8px}.wv-row input{flex:1}.wv-actions{display:flex;gap:8px;margin-top:16px}.wv-actions button,.wv-row button{padding:8px 12px;border-radius:8px;border:1px solid #6f89a8;background:#1b2a3b;color:#fff;cursor:pointer}.wv-actions button:hover,.wv-row button:hover{background:#27415c}.wv-muted{color:#c3d0e3;opacity:1;font-size:12px}`),
        React.createElement("h2", null, "语音输入"),
        React.createElement("p", { className: "wv-muted" }, "识别仍在本机 Electron 主进程运行；音频和文字不会为了识别发送到云端。"),
        React.createElement("section", { className: "wv-group" },
          select("Whisper 模型", "model", payload.models, LABELS.models),
          select("识别语言", "language", payload.languages, LABELS.languages),
          select("运行设备", "device", payload.devices, LABELS.devices),
          React.createElement("label", { className: "wv-field" }, React.createElement("span", null, "模型存放目录（留空使用默认缓存）"), React.createElement("div", { className: "wv-row" }, React.createElement("input", { value: draft.cacheDir, placeholder: "默认缓存目录", onChange: (event) => setDraft({ ...draft, cacheDir: event.target.value }) }), React.createElement("button", { type: "button", onClick: pickDirectory }, "浏览…"))),
          React.createElement("div", { className: "wv-actions" }, React.createElement("button", { onClick: () => save(false) }, "保存"), React.createElement("button", { onClick: () => save(true) }, "保存并准备模型")),
          React.createElement("p", { className: "wv-muted" }, status || "配置文件：" + payload.dataPath),
          !window.whaleVoice && React.createElement("p", { className: "wv-muted" }, "当前不是鲸鱼娘 Electron 客户端：可以编辑设置，但本页不能直接下载模型或打开目录选择器。")
        )
      );
    }

    function apply(ctx) {
      try {
        ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "whale-voice", order: 61, label: "语音" }, VoicePanel));
      } catch (error) {
        console.warn("[whale-voice] settings section unavailable", error);
      }
    }
    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    exports.default = { apply, inject, name };
    return module.exports;
  }
});
