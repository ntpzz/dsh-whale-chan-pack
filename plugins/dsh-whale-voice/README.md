# dsh-whale-voice

鲸鱼娘 Electron 客户端的 DSH 左侧「语音」设置页。

- 设置 Whisper 模型、识别语言、运行设备和模型缓存目录。
- 配置持久化至 `~/.dsh/whale-voice/config.json`，Electron 与 DSH 插件共用。
- 在 Electron 中可以选择目录并预下载模型；普通浏览器中仍可安全查看和编辑配置。
- Node 与客户端入口同时提供命名 `apply` 和 `default { apply }`。
