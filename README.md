# dsh-whale-pack · DSH「鲸鱼·整合包」

> 把几个开源的 **DeepSeek Harness (dsh)** 插件 + 一个「关窗即退」桌面客户端打成一包，装一次即得一套带鲸鱼娘主题、会轮换状态梗文案的桌面版 DSH。

面向 Windows（`dsh web`），纯配置集成，不修改 dsh 本体。

---

## 里面有什么

| 组件 | 作用 | 上游 |
|---|---|---|
| **dsh-whale-desktop-launcher** | 桌面鲸鱼启动器 `DeepSeek Harness.exe`（隐藏后端 + 复用实例） | [HUITianYi/dsh-whale-desktop-launcher](https://github.com/HUITianYi/dsh-whale-desktop-launcher) |
| **dsh-status-rotator** | 把回合底部 “Deep diving…” 换成可轮换/打字机/渐变/弹幕的状态文案 | [01Virex/dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator) |
| **dsh-deep-whale** (skin-manager) | 皮肤发现/切换面板 | [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) |
| **dsh-deep-whale** (maid-atelier) | 深海女仆工坊皮肤（本包默认启用） | 同上 |
| **dsh-deep-whale** (orca-link) | 虎鲸链路皮肤（本包默认停用，可到设置切换） | 同上 |
| **desktop/**（本包自带） | 「关窗即退」客户端：隐藏启动 `dsh web`，关掉独立窗口即停后端 | —（本包，MIT） |

依赖运行环境：**DeepSeek Harness (`dsh web`) + Node ≥ 22.19 + Chrome/Edge + pnpm ≥ 9**。

---

## 安装

### 方式一：脚本（推荐）

```powershell
# 管理员/普通终端均可；需要 node、pnpm、git 与网络
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -ProfileName web
```

脚本会自动：用 pnpm 把上面 5 个包装进 `~/.dsh/profiles/<name>` → 注册进 `dsh.profile.bundles` → 写皮肤互斥（启用 manager + maid，停用 orca）→ 给 status-rotator 生成默认词库 `config.json`。

### 方式二：手动 `dsh plugin add`

```powershell
# （若你的 pnpm 提示 workspace-root 需 -w，请改用方式一的脚本）
dsh plugin --profile web add dsh-status-rotator
dsh plugin --profile web add github:HUITianYi/dsh-whale-desktop-launcher#v0.1.0
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

首次安装都需要**重启一次 `dsh web`** 才会生效（本包只改了配置层，不热改正在运行的实例）。重启后在「设置」里能看到 **状态文案** 页和 **皮肤管理** 页。

---

## 桌面客户端（本包自带）

| 文件 | 用法 |
|---|---|
| `desktop\launch.vbs` | 双击：隐藏启动 `dsh web` + 独立 Chrome 应用窗口；**关窗即自动停后端** |
| `desktop\stop.vbs` | 双击：停掉占用 127.0.0.1:3080 的后台 `dsh web`（配合常驻型鲸鱼 EXE 用） |

可把 `launch.vbs` 右键发送到桌面/创建快捷方式。想要桌面直接留一个快捷方式（如 `DeepSeek（关窗即退）.lnk`），指向 `wscript.exe` 并给参数为 `launch.vbs` 的路径即可。可用环境变量覆盖路径：`DSH_CLIENT_NODE / DSH_CLIENT_DSH / DSH_CLIENT_CHROME / DSH_CLIENT_PORT / DSH_CLIENT_WORKSPACE`。

> 注意：`launch.vbs` 需要端口 3080 空闲；若已有其它 `dsh` 实例在跑（例如旧终端里手启动的），先停掉它再双击。

---

## 许可与引用（务必阅读）

本项目（整合编排、`desktop/` 客户端、安装脚本）以 **MIT** 发布，见 [LICENSE](LICENSE)。

**你只是“打包”，不拥有上游代码/美术版权**。各上游仓库及许可、美术署名请见 [NOTICE.md](NOTICE.md)。其中鲸鱼娘相关**美术**为 **CC BY-NC-SA 4.0（禁止商用）**，发布整合包时请保留署名与许可链接。

详见 [NOTICE.md](NOTICE.md) 与 [plugins/install.md](plugins/install.md)。
