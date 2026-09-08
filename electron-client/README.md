# 鲸鱼娘 DSH 桌面客户端（Electron 内核）

用 **Electron**（自带 Chromium）替代“Chrome 应用窗口”，因此**窗口/任务栏图标 = 桌面图标 = 鲸鱼娘 `whale.ico`**，彻底统一。

- 隐藏地启动 `dsh web` → 用鲸鱼图标窗口打开其 token URL → **关窗自动停后端**。
- 内置轻量提示：`🐋 大肥鱼吃了 ~N token · ≈¥X`（按当前对话文本量估算，DeepSeek 近期价，非精确计费）。
- 进程内存基线通常 <300MB。

## 运行（需本机 Node + 先 `dsh web` 配置好）
```powershell
cd electron-client
npm install          # 拉取 electron
npm start            # 或 npx electron .
```
> 首次 `npm install electron` 会下载 Electron（约 100MB+）。改图标替换 `whale.ico` 即可。

## 说明
- 不依赖 Chrome；`whale.ico` 为上游鲸鱼娘美术（CC BY-NC-SA 4.0），见仓库 `NOTICE.md`。
- 本文件仅提供源码；运行/打包请在本机执行（环境内未内置运行验证）。
