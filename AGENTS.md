# AGENTS.md

本文件是 AI 代理(Claude Code / Codex / 其他)在 keroro 仓库内工作的入口。  
内容刻意保持精炼,详细规则放在 `docs/` 下的专题文档里——按主题进入,不要一次性塞进上下文。

## 一句话项目说明

keroro 是 Tauri 2 + Solid.js + xterm.js 的桌面工作台,把 Claude Code / Codex 等 CLI agent 封装在多项目、多会话、可拆分窗格的工作区里,SQLite 本地持久化。

## 工作前必读

1. **当前任务相关的那一份**——只读你要动的那一层(前端/后端/构建/…)。
2. **`docs/CONVENTIONS.md`**——下笔前的硬约束,违反它的 PR 会被打回。

## 文档地图

| 文档 | 用途 | 什么时候读 |
| --- | --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 整体分层、IPC 契约、数据流 | 跨层改动、加新功能前 |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Solid + xterm 的组件、状态、布局树 | 改 `src/` 任意文件 |
| [docs/BACKEND.md](docs/BACKEND.md) | Rust + Tauri 命令、PTY、SQLite | 改 `src-tauri/` 任意文件 |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | 代码风格、命名、文件大小、注释边界 | 每次提交前 |
| [docs/WORKFLOWS.md](docs/WORKFLOWS.md) | 本地开发、构建、发布、CI | 跑命令前、改 CI 前 |
| [docs/HARNESS.md](docs/HARNESS.md) | 这套文档为什么这样组织(理念) | 想加新规则、改文档结构时 |

## 仓库最小心智模型

```
keroro/
├── src/              前端 (Solid.js, TypeScript)
│   ├── App.tsx       主组件 (布局树、拖拽、Tab、侧栏)
│   ├── XtermPane.tsx 单个终端窗格
│   ├── persistence.ts Tauri 命令的 TypeScript 包装
│   ├── themes.ts     四套主题 (ember/forest/plum/zed)
│   └── mascots.tsx   像素吉祥物 SVG
├── src-tauri/        后端 (Rust)
│   └── src/
│       ├── lib.rs    Tauri 启动 + 命令注册
│       ├── pty.rs    portable-pty 包装,前端 emit 字节流
│       ├── db.rs     SQLite (rusqlite) 持久化
│       ├── claude.rs Claude Code 的会话恢复路径计算
│       └── sys_info.rs Node / git / CLI 探测
├── docs/             本套工程文档
└── .github/workflows/release.yml 多平台打包发布
```

## 不变量(违反则视为 bug)

- 前端**只**通过 `src/persistence.ts` 调用后端命令。新命令要先在那里加包装。
- 后端命令在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 里注册,**忘了注册就等于不存在**。
- SQLite schema 的字段顺序与 `src/persistence.ts` 中的 `ProjectRow / SessionRow` 必须对齐。
- 改 `db.rs` 的 schema 时,必须考虑老 DB 的迁移路径(参见 `db.rs` 现有的 `ALTER TABLE` 兜底)。
- App.tsx 已经过大(>2600 行),**新功能默认拆文件**,不要继续往里塞。

## 不在 repo 里就不存在

这是 harness engineering 的核心准则:外部聊天记录、Notion 文档、口头约定对 agent 不可见。任何新的"事实"(架构决策、命名约定、踩坑教训、第三方接口怪癖)如果会影响下一次改动,**就地写进对应文档**而不是放别处。
