window.__ModuleLoader__.load({
  id: "dsh-whale-meter",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const name = "whale-meter";
    const inject = ["slots"];
    const URL = "/plugins/dsh-whale-meter/state.json";

    const access = (ctx, key) => {
      try { const value = typeof ctx.get === "function" ? ctx.get(key) : null; if (value) return value; } catch {}
      try { return ctx[key] || null; } catch { return null; }
    };
    const usageOf = (value) => {
      if (!value || typeof value !== "object") return null;
      const keys = ["uncachedInputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"];
      const out = {};
      for (const key of keys) out[key] = Math.max(0, Number(value[key]) || 0);
      return out;
    };
    const collectSessions = (ctx) => {
      const sessions = access(ctx, "sessions");
      if (!sessions?.list?.getSnapshot) return [];
      const snapshot = sessions.list.getSnapshot();
      const rows = [];
      for (const id of snapshot?.ids || []) {
        const summary = snapshot.byId?.[id];
        let usage = usageOf(summary?.projectionValues?.tokenUsage);
        try {
          const binding = sessions.binding?.(id);
          usage ||= usageOf(binding?.session?.projections?.get?.("tokenUsage"));
        } catch {}
        if (usage) rows.push({ id: String(id), title: summary?.displayTitle || summary?.title || String(id), usage });
      }
      return rows;
    };
    const postSnapshots = async (ctx) => {
      const rows = collectSessions(ctx);
      if (!rows.length) return null;
      const response = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessions: rows }) });
      return response.ok ? response.json() : null;
    };
    const money = (value) => Number(value || 0).toFixed(4);
    const tokens = (usage) => Object.values(usage || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const compactTokens = (value) => {
      const amount = Math.max(0, Number(value) || 0);
      if (amount >= 1e9) return (amount / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
      if (amount >= 1e6) return (amount / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
      if (amount >= 1e3) return (amount / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
      return String(Math.round(amount));
    };

    // The stock workspace row does not expose a session-row slot.  Keep this
    // tiny, DOM-only decoration isolated: token data still comes from the
    // official sessions store above, and a MutationObserver reapplies it when
    // React rerenders the sidebar.
    function SidebarTokenLabels() {
      const ctx = SidebarTokenLabels.ctx;
      const [, refresh] = React.useState(0);
      React.useEffect(() => {
        const sessions = access(ctx, "sessions");
        const sync = () => refresh((value) => value + 1);
        let unsubscribe = null;
        try { unsubscribe = sessions?.list?.subscribe?.(sync) || null; } catch {}
        const observer = new MutationObserver(sync);
        try { observer.observe(document.body, { childList: true, subtree: true }); } catch {}
        const timer = setInterval(sync, 3000);
        return () => { try { unsubscribe?.(); } catch {} observer.disconnect(); clearInterval(timer); };
      }, [ctx]);
      React.useEffect(() => {
        const byTitle = new Map();
        for (const row of collectSessions(ctx)) byTitle.set(String(row.title || "").trim(), tokens(row.usage));
        for (const item of document.querySelectorAll("[role='treeitem']")) {
          const title = item.querySelector("span[class*='_title']");
          if (!title) continue;
          const value = byTitle.get(String(title.textContent || "").trim());
          let badge = item.querySelector("[data-whale-session-token]");
          if (value === undefined) { badge?.remove(); continue; }
          if (!badge) {
            badge = document.createElement("span");
            badge.dataset.whaleSessionToken = "";
            badge.style.cssText = "flex:none;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;margin-right:6px;pointer-events:none;";
            title.insertAdjacentElement("afterend", badge);
          }
          badge.textContent = compactTokens(value);
          badge.title = `${Math.round(value).toLocaleString()} token`;
        }
      });
      return null;
    }

    function MeterPanel() {
      const ctx = MeterPanel.ctx;
      const [state, setState] = React.useState(null);
      const [draft, setDraft] = React.useState(null);
      const [message, setMessage] = React.useState("正在读取本地记录…");
      const load = React.useCallback(async () => {
        try {
          await postSnapshots(ctx);
          const response = await fetch(URL, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const next = await response.json();
          setState(next); setDraft({ ...next.config }); setMessage("");
        } catch (error) { setMessage("费用服务暂不可用：" + String(error?.message || error)); }
      }, [ctx]);
      React.useEffect(() => {
        load();
        const sessions = access(ctx, "sessions");
        const sync = () => postSnapshots(ctx).then((next) => next && setState(next)).catch(() => {});
        let unsubscribe = null;
        try { unsubscribe = sessions?.list?.subscribe?.(sync) || null; } catch {}
        const timer = setInterval(sync, 5000);
        return () => { try { unsubscribe?.(); } catch {} clearInterval(timer); };
      }, [ctx, load]);
      const save = async (refreshPrice = false) => {
        try {
          setMessage(refreshPrice ? "正在读取 DeepSeek 官方价格…" : "正在保存…");
          const response = await fetch(URL, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: draft, refreshPrice }) });
          const next = await response.json();
          if (!response.ok) throw new Error(next.error || `HTTP ${response.status}`);
          setState(next); setDraft({ ...next.config }); setMessage("已保存到本地文件");
        } catch (error) { setMessage("保存失败：" + String(error?.message || error)); }
      };
      if (!state || !draft) return React.createElement("div", { className: "wm-page" }, message);
      const total = state.totalTokens || 0;
      const preview = draft.text.replace("{tokens}", total.toLocaleString()).replace("{currency}", draft.currency).replace("{cost}", money(state.cost));
      const field = (label, key, type = "text", step) => React.createElement("label", { className: "wm-field", key },
        React.createElement("span", null, label),
        React.createElement("input", { type, step, value: draft[key], onChange: (event) => setDraft({ ...draft, [key]: type === "number" ? Number(event.target.value) : event.target.value }) })
      );
      const rows = Object.values(state.sessions || {}).sort((a, b) => b.updatedAt - a.updatedAt);
      return React.createElement("div", { className: "wm-page" },
        React.createElement("style", null, `.wm-page{max-width:920px;padding:8px 4px 40px;color:inherit}.wm-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.wm-card,.wm-group{border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:14px;padding:16px;background:color-mix(in srgb,currentColor 4%,transparent)}.wm-card b{display:block;font-size:24px;margin-top:8px}.wm-group{margin-top:14px}.wm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.wm-field{display:flex;flex-direction:column;gap:5px;font-size:13px}.wm-field input{padding:8px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:8px;background:transparent;color:inherit}.wm-actions{display:flex;gap:8px;margin-top:12px}.wm-actions button{padding:8px 12px;border-radius:8px;border:1px solid color-mix(in srgb,currentColor 24%,transparent);background:transparent;color:inherit;cursor:pointer}.wm-table{width:100%;border-collapse:collapse}.wm-table td,.wm-table th{text-align:left;padding:8px;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent)}.wm-muted{opacity:.65;font-size:12px}@media(max-width:700px){.wm-cards,.wm-grid{grid-template-columns:1fr}}`),
        React.createElement("h2", null, "费用 / 用量"),
        React.createElement("p", { className: "wm-muted" }, "优先使用 DSH 服务端 tokenUsage；价格为估算值，实际账单以提供商为准。"),
        React.createElement("div", { className: "wm-cards" },
          React.createElement("div", { className: "wm-card" }, "累计 Token", React.createElement("b", null, total.toLocaleString())),
          React.createElement("div", { className: "wm-card" }, "估算费用", React.createElement("b", null, draft.currency + money(state.cost))),
          React.createElement("div", { className: "wm-card" }, "已记录会话", React.createElement("b", null, rows.length))
        ),
        React.createElement("section", { className: "wm-group" }, React.createElement("h3", null, "显示文案"), field("模板（支持 {tokens} {currency} {cost}）", "text"), React.createElement("p", null, preview)),
        React.createElement("section", { className: "wm-group" }, React.createElement("h3", null, "计费规则（USD / 1M token）"),
          React.createElement("div", { className: "wm-grid" }, field("缓存命中输入", "cacheHit", "number", "0.000001"), field("缓存未命中输入", "cacheMiss", "number", "0.000001"), field("输出", "output", "number", "0.000001"), field("美元换算系数", "usdToCurrency", "number", "0.01"), field("显示货币", "currency"), field("模型", "model")),
          React.createElement("label", { className: "wm-field" }, React.createElement("span", null, "每日自动跟随官方价格"), React.createElement("input", { type: "checkbox", checked: draft.autoUpdatePrice, onChange: (event) => setDraft({ ...draft, autoUpdatePrice: event.target.checked }) })),
          React.createElement("div", { className: "wm-actions" }, React.createElement("button", { onClick: () => save(false) }, "保存"), React.createElement("button", { onClick: () => save(true) }, "立即更新官方价格")),
          React.createElement("p", { className: "wm-muted" }, message || `价格来源：${state.pricing?.source || "内置"} · ${state.pricing?.error ? "上次更新失败：" + state.pricing.error : "正常"}`),
          React.createElement("p", { className: "wm-muted" }, "本地文件：" + state.dataPath)
        ),
        React.createElement("section", { className: "wm-group" }, React.createElement("h3", null, "按会话"),
          React.createElement("table", { className: "wm-table" }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "会话"), React.createElement("th", null, "Token"), React.createElement("th", null, "估算费用"))),
            React.createElement("tbody", null, rows.map((row) => React.createElement("tr", { key: row.id }, React.createElement("td", null, row.title), React.createElement("td", null, tokens(row.usage).toLocaleString()), React.createElement("td", null, draft.currency + money((row.usage.uncachedInputTokens * draft.cacheMiss + row.usage.cacheReadTokens * draft.cacheHit + row.usage.cacheWriteTokens * draft.cacheMiss + row.usage.outputTokens * draft.output) / 1e6 * draft.usdToCurrency))))))
        )
      );
    }

    function apply(ctx) {
      MeterPanel.ctx = ctx;
      SidebarTokenLabels.ctx = ctx;
      try {
        ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "whale-meter", order: 60, label: "费用 / 用量" }, MeterPanel));
      } catch (error) {
        console.warn("[whale-meter] settings section unavailable", error);
      }
      try {
        ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({ name: "sidebar.footer.action", id: "whale-session-tokens", order: 60 }, SidebarTokenLabels));
      } catch (error) {
        console.warn("[whale-meter] sidebar token labels unavailable", error);
      }
    }
    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    exports.default = { apply, inject, name };
    return module.exports;
  }
});
