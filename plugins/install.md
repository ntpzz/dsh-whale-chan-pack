# 插件安装指引（上游）

本包各插件都从上游直接安装（不复制它们的代码），保持可随上游更新。

## 前置

- DeepSeek Harness 已配置好 `web` profile（至少 `dsh web` 启动过一次）
- Node.js ≥ 22.19
- pnpm ≥ 9（`npm i -g pnpm@9`）
- git + 网络

> 如果 `dsh plugin add` 在你的 pnpm 下提示 `ERR_PNPM_ADDING_TO_ROOT` / 需要 `-w`，
> 说明你处在 workspace-root：请直接用仓库根目录的 `scripts\install.ps1`（内部用 `pnpm add -w` + 注册 bundle），
> 效果等同。

## 各插件

### dsh-status-rotator

```powershell
dsh plugin --profile web add dsh-status-rotator
```

首次使用需生成默认词库 `config.json`（脚本会自动从 `config.example.json` 复制），重启一次 `dsh web`。

### dsh-whale-desktop-launcher

```powershell
dsh plugin --profile web add github:HUITianYi/dsh-whale-desktop-launcher#v0.1.0
```

激活后会在桌面生成 `DeepSeek Harness.exe` 并写入 `~/.dsh/whale-desktop-launcher/`。

### dsh-deep-whale（皮肤，3 个 #path 子包）

```powershell
dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/skin-manager'
dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/maid-atelier'
dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/orca-link'
```

两套皮肤互斥，需在 profile 层与 home 层各写互斥行（见 README「皮肤互斥」）。本包默认启用 maid-atelier、停用 orca-link；切肤在「设置 → 皮肤管理」。

## 验证

```powershell
dsh plugin --profile web list
dsh --profile web --dump-config   # 应看到 status-rotator / ui-skin-* / whale-desktop-launcher 各行
```

装完重启一次 `dsh web` 即全部生效。
