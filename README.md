# keroro

keroro 是一个面向 CLI coding agent 的桌面工作台。

它用 Tauri 2 + Solid.js + xterm.js 把普通终端、Claude Code、Codex 等命令行工具放进一个多项目、多会话、可拆分窗格的本地应用里。你可以把它理解成“专门为 agent 工作流做的轻量终端工作区”。

## 适合谁

- 经常在多个代码仓库之间切换的人。
- 同时跑多个 terminal / Claude Code / Codex 会话的人。
- 希望布局、会话和项目列表能自动恢复，但不想引入云端工作区的人。
- 想要一个比纯终端更适合拖拽、分屏、主题和项目状态展示的桌面壳。

## 主要功能

- **多项目工作区**：侧栏管理多个本地文件夹，快速切换项目。
- **分屏与标签页**：标签页可拖拽移动，拖到窗格边缘即可拆成左右/上下分屏。
- **PTY 终端**：每个 terminal / CLI agent 标签页背后都是独立 PTY，会话在移动标签或切换项目时保持运行。
- **CLI agent 集成**：自动探测已安装的 `claude` 和 `codex`，只在可用时显示对应入口。
- **Claude 会话恢复**：Claude Code 标签会尽量按已有 session id 恢复；恢复失败时自动创建新会话并继续。
- **本地持久化**：项目列表、标签页、分屏布局、当前项目等写入本机 SQLite。
- **终端体验**：xterm.js + WebGL 渲染、链接识别、终端搜索、字体大小快捷键、字体选择。
- **项目状态提示**：显示当前项目的 Node 版本、Git 分支、ahead/behind、dirty 状态和行变更统计。
- **等待输入提示**：当 agent/终端看起来在等待确认或回答时，标签和项目侧栏会出现提示点。
- **主题与偏好**：内置 Ember / Forest / Plum / Zed Light 主题，支持 cozy/compact 密度和中英文界面。
- **应用更新**：release 构建可通过 GitHub Releases 检查并安装更新。

## 隐私与数据

keroro 没有远程后端，也没有遥测或 crash 上报。

本地 SQLite 只保存项目元信息、会话元信息和布局数据，不保存终端输出或用户输入。需要注意的是，Claude Code、Codex 等 CLI agent 本身可能会按各自产品逻辑把上下文发送给对应服务商；这部分由你运行的 CLI 工具决定，不由 keroro 接管。

## 安装与运行

当前发布流程主要面向 macOS arm64 和 Windows。安装包见 GitHub Releases：

<https://github.com/Lee94/keroro/releases>

已知平台提示：

- **macOS**：当前包未做 Apple 代码签名/公证，首次打开可能需要右键打开，或在“系统设置 → 隐私与安全性”里允许。
- **Windows**：Tauri 依赖 WebView2 Runtime；较旧系统如果没有安装，首次运行时会按系统提示安装。

## 基本用法

1. 点击标题栏的 **+ new project / 新建项目**，选择一个本地文件夹。
2. 在空窗格里点 **New terminal / 新建终端**，或点击标签栏的 `+` 添加新标签。
3. 如果系统能找到 `claude` 或 `codex`，菜单里会显示 Claude Code / Codex 入口。
4. 拖动标签页：
   - 拖到另一个窗格中间：合并为同一组标签。
   - 拖到窗格边缘：创建左右/上下分屏。
5. 双击标签名称可重命名；点击关闭按钮可结束对应标签。
6. 打开 **Tweaks / 偏好** 可切换主题、语言、密度、终端字体和字号。

常用快捷键：

| 快捷键 | 作用 |
| --- | --- |
| `Cmd/Ctrl + B` | 显示/隐藏侧栏 |
| `Cmd/Ctrl + F` | 在当前终端里搜索 |
| `Cmd/Ctrl + =` / `Cmd/Ctrl + +` | 放大终端字号 |
| `Cmd/Ctrl + -` | 缩小终端字号 |
| `Cmd/Ctrl + 0` | 重置终端字号 |

## 本地开发

需要先准备：

- Node.js
- pnpm
- Rust / Cargo
- Tauri 2 对应平台依赖

安装依赖：

```bash
pnpm install
```

启动桌面应用开发模式：

```bash
pnpm tauri dev
```

只启动前端 Vite 服务（浏览器里调 UI 时可用，但 Tauri API 会不可用）：

```bash
pnpm dev
```

构建前端：

```bash
pnpm build
```

打包当前平台桌面应用：

```bash
pnpm tauri build
```

## 项目结构

```text
keroro/
├── src/                    Solid.js 前端
│   ├── App.tsx             应用根组件与全局状态装配
│   ├── XtermPane.tsx       xterm.js + PTY 标签页
│   ├── chrome/             标题栏、更新提示等窗口 chrome
│   ├── workspace/          项目侧栏、空工作区
│   ├── panes/              分屏树、标签栏、拖拽、搜索栏
│   ├── settings/           偏好面板与本地设置
│   ├── persistence.ts      Tauri 命令 TypeScript 包装
│   └── themes.ts           主题定义
├── src-tauri/              Rust / Tauri 后端
│   └── src/
│       ├── lib.rs          Tauri 启动和命令注册
│       ├── pty.rs          PTY 子进程管理
│       ├── db.rs           SQLite 持久化
│       ├── claude.rs       Claude Code 会话恢复参数
│       └── sys_info.rs     Node / Git / CLI 探测
├── docs/                   架构、前后端约定、工作流文档
└── .github/workflows/      发布构建 workflow
```

## 贡献与维护文档

开发前建议先读：

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)：整体架构和 IPC 契约。
- [`docs/FRONTEND.md`](docs/FRONTEND.md)：Solid、xterm、布局树和主题约定。
- [`docs/BACKEND.md`](docs/BACKEND.md)：Rust、Tauri 命令、PTY、SQLite 约定。
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)：代码风格和硬性规则。
- [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)：本地开发、构建和发布流程。

如果你在改动中发现新的约定、坑点或架构事实，请把它写进对应文档，而不是只留在聊天记录或 PR 描述里。

## License

MIT
