# dsh-whale-chan-pack

> DeepSeek Harness (DSH) 鲸鱼娘整合包。项目只保留一个桌面客户端：`electron-client`。

面向 Windows（`dsh web`），纯配置集成，不修改 dsh 本体。

---

## 里面有什么

| 组件 | 作用 | 上游 |
|---|---|---|
| **dsh-pilot** | 通过 Chrome CDP 控制真实浏览器（导航、点击、输入、截图） | [guo6x/dsh-pilot](https://github.com/guo6x/dsh-pilot) |
| **dsh-status-rotator** | 把回合底部 “Deep diving…” 换成可轮换/打字机/渐变/弹幕的状态文案 | [01Virex/dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator) |
| **dsh-deep-whale** (skin-manager) | 皮肤发现/切换面板 | [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) |
| **dsh-deep-whale** (maid-atelier) | 深海女仆工坊皮肤（本包默认启用） | 同上 |
| **dsh-deep-whale** (orca-link) | 虎鲸链路皮肤（本包默认停用，可到设置切换） | 同上 |
| **dsh-whale-meter** | 设置中的费用/用量页，本地持久化统计 | 本项目 |
| **dsh-whale-voice** | 设置中的语音配置页，与 Electron 本地 Whisper 共享配置 | 本项目 |

依赖运行环境：**DeepSeek Harness (`dsh web`) + Node ≥ 22.19 + Chrome/Edge + pnpm ≥ 9**。安装前请先在目标电脑运行一次 `npx @deepseek-ai/dsh web`，让它创建 `web` profile 后退出。

---

## 安装

### 方式一：脚本（推荐）

```powershell
# 管理员/普通终端均可；需要 node、pnpm、git 与网络
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -ProfileName web
```

脚本会自动：移除旧的桌面启动器 → 把费用/语音页、状态文案、`dsh-pilot` 和皮肤装进 `~/.dsh/profiles/<name>` → 注册 bundle → 写皮肤互斥（启用 manager + maid，停用 orca）→ 安装并打包 Electron → 在桌面创建唯一的 **DeepSeek Harness.exe**。

### 方式二：手动 `dsh plugin add`

```powershell
# （若你的 pnpm 提示 workspace-root 需 -w，请改用方式一的脚本）
dsh plugin --profile web add dsh-status-rotator
dsh plugin --profile web add github:guo6x/dsh-pilot
dsh plugin --profile web add C:\\path\\to\\dsh-whale-chan-pack\\plugins\\dsh-whale-meter
dsh plugin --profile web add C:\\path\\to\\dsh-whale-chan-pack\\plugins\\dsh-whale-voice
dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/skin-manager'
dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/maid-atelier'
dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/orca-link'
```

皮肤互斥需在 `~/.dsh/profiles/web/cordis.patch.yml` 与 `~/.dsh/cordis.patch.yml` 里写（本包默认只启 maid）：

```yaml
- id: ui-skin-maid-atelier
  disabled: false
- id: ui-skin-orca-link
  disabled: true
- id: ui-skin-deep-whale-manager
  disabled: false
```

### 装完

首次安装都需要**重启一次 `dsh web`** 才会生效（本包只改了配置层，不热改正在运行的实例）。之后只双击桌面的 **DeepSeek Harness.exe**：它会启动 DSH、打开唯一窗口；关窗时会先让 DSH 写完会话记录再退出。设置中会看到 **费用/用量**、**语音**、**状态文案** 与 **皮肤管理** 页；侧边栏底部出现 ✈️ 即表示浏览器控制可用。

---

## 客户端

本包唯一客户端是 `electron-client`。安装脚本会在桌面创建可直接双击的 **DeepSeek Harness.exe**，不是快捷方式；不会同时安装旧的 VBS/Chrome 启动器。GitHub 不提交约 195 MB 的二进制文件，脚本会在每台电脑上以同一份锁定依赖本地生成它。

```powershell
cd electron-client
npm start
```

重新生成 EXE：

```powershell
cd electron-client
npm run dist:win
```

---

## 许可与引用（务必阅读）

本项目（整合编排、Electron 客户端、安装脚本）以 **MIT** 发布，见 [LICENSE](LICENSE)。

**本作品只是“打包”，不拥有上游代码/美术版权**。各上游仓库及许可、美术署名请见 [NOTICE.md](NOTICE.md)。其中鲸鱼娘相关**美术**为 **CC BY-NC-SA 4.0（禁止商用）**，发布整合包时请保留署名与许可链接。

详见 [NOTICE.md](NOTICE.md) 与 [plugins/install.md](plugins/install.md)。
