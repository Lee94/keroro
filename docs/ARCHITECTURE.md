# Architecture

keroro 是一个 Tauri 2 桌面应用,前端 Solid.js 渲染 UI,Rust 后端管 PTY、SQLite、外部 CLI 探测。本文档描述层与层之间的契约。

## 分层

```
┌─────────────────────────────────────────────────┐
│  UI 层  (src/App.tsx, XtermPane.tsx)            │
│   - 布局树, Tab, 拖拽, 主题, 吉祥物              │
└────────────────┬────────────────────────────────┘
                 │  调用
┌────────────────▼────────────────────────────────┐
│  IPC 包装层  (src/persistence.ts, terminalHost) │
│   - 唯一允许调用 invoke() 的地方                 │
│   - 维护 TS 类型与后端命令的一一对应             │
└────────────────┬────────────────────────────────┘
                 │  invoke()  +  emit/listen 事件
┌────────────────▼────────────────────────────────┐
│  Tauri 命令层  (src-tauri/src/lib.rs)            │
│   - invoke_handler! 注册所有命令                 │
└────────────────┬────────────────────────────────┘
                 │
┌──────────┬─────┴──────┬──────────────┬──────────┐
│  pty.rs  │   db.rs    │  claude.rs   │ sys_info │
│ portable-│  rusqlite  │  会话路径    │  CLI/git │
│   pty    │  WAL+FK    │  推断        │  探测    │
└──────────┴────────────┴──────────────┴──────────┘
```

**例外**:`src/XtermPane.tsx` 直接 `invoke("pty_write" / "pty_resize")` 和 `listen("pty:{id}:data")`。这是性能权衡——PTY 字节流频次高,不绕一层包装。其他所有跨界调用都必须走 `persistence.ts`。

## Tauri 命令清单(快速参考)

来源:`src-tauri/src/lib.rs:21-40`。新增/删除时**两边同步**。

### PTY (`pty.rs`)
| 命令 | 用途 |
| --- | --- |
| `pty_spawn` | 启动子进程,返回 PTY 句柄 id |
| `pty_write` | 写字节到子进程 stdin |
| `pty_resize` | 调整窗口大小,触发 SIGWINCH |
| `pty_kill` | 结束子进程并释放句柄 |

PTY 输出通过 `emit("pty:{id}:data", base64)` 推给前端,前端 `listen` 同名事件。退出事件类似 `pty:{id}:exit`。

### 系统探测 (`sys_info.rs`)
| 命令 | 返回 |
| --- | --- |
| `detect_node_version(cwd?)` | `Option<String>`,如 `v22.4.0` |
| `detect_git_branch(cwd)` | `Option<String>`,读 `.git/HEAD` 不调用 git |
| `detect_clis()` | `Vec<CliInfo>`,目前探测 `claude` 和 `codex` |

`find_cli` 会额外查 `~/.local/bin`、`/opt/homebrew/bin`、`/usr/local/bin`——因为 macOS .app 从 Finder 启动时 PATH 被剥光。

### Claude (`claude.rs`)
| 命令 | 返回 |
| --- | --- |
| `claude_spawn_args(session_id, cwd?)` | `["--resume", id]` 或 `["--session-id", id]` |
| `claude_session_title(session_id, cwd?)` | `Option<String>`,会话 JSONL 里第一条用户消息(截断到 40 字符) |
| `claude_unlock_session(session_id)` | `bool`,扫 `~/.claude/sessions/*.json`,若有匹配 sessionId 但 pid 已死的"僵尸"注册文件则删除,返回是否解锁成功 |

`claude_spawn_args` 逻辑:把 cwd 规范化、剥掉 Windows 的 `\\?\` 扩展前缀,再把 `/`、`\`、`:`、`.` 全替换成 `-`,在 `~/.claude/projects/<encoded>/<session-id>.jsonl` 找文件;存在则 `--resume`,否则 `--session-id` 创建新会话。**Windows 上务必同时替换 `\` 和 `:`**,否则查找路径与 Claude 实际写入的目录对不上(如 `D:\work\keroro` 应编码为 `D--work-keroro`,而不是把反斜杠和冒号保留)。

`claude_session_title` 复用同一份路径,读 JSONL,挑第一条 `type=user` 且 `content` 为字符串的条目作为 tab 自动标题——前端 `XtermPane` 在挂载后轮询调用,命中后停止。

> 接新的 code CLI(claude / codex / gemini …)的完整清单见 [BACKEND.md#集成一个新的-code-cli](BACKEND.md#集成一个新的-code-cliclaude--codex--未来的-gemini--pi-)。

### 持久化 (`db.rs`)
| 命令 | 说明 |
| --- | --- |
| `projects_list` | 按 `position` 升序返回所有项目 |
| `project_upsert` | 单个项目插入/更新 |
| `projects_replace` | 全量替换(用于拖拽排序) |
| `project_delete` | 级联删除 sessions 和 layout |
| `sessions_list` | 按项目查会话 |
| `sessions_replace` | 全量替换某项目的会话 |
| `layout_get / layout_set` | 项目的分屏树 JSON |
| `active_project_get / set` | 全局当前项目 id |

## 数据模型(SQLite)

权威定义在 `src-tauri/src/db.rs:9-40`。摘要:

```sql
projects(id PK, name, path UNIQUE, mascot, position, created_at, updated_at)
sessions(id PK, project_id FK→projects ON DELETE CASCADE,
         kind, title, cli_session_id, created_at)
project_layouts(project_id PK FK→projects ON DELETE CASCADE, tree_json, updated_at)
app_state(key PK, value)
```

PRAGMA:`journal_mode=WAL`,`foreign_keys=ON`。

布局树的 JSON 形状定义在 `src/persistence.ts` 的 `LayoutNode`(`split` / `leaf`)。后端只存字符串,不解析,**前端是布局的唯一权威**。

## 数据流示例:打开一个项目

1. 用户在侧栏点项目 → `App.tsx` 调 `setActiveProject(id)` 写 DB。
2. `getLayout(id)` 读 `tree_json`,解析成 `LayoutNode`。
3. 树中每个 `leaf` 拿到 `tabIds`,通过 `listSessions` 拿到对应 `SessionRow`。
4. UI 渲染若干 `XtermPane`,每个 pane `invoke("pty_spawn", { cwd, args })` 获得 `pty_id`。
5. xterm 接管 `pty:{id}:data` 事件并写入 terminal。
6. 用户输入 → xterm `onData` → `invoke("pty_write", { id, data })`。

## 跨平台

- **macOS**: 用 zsh 包子进程(`pty.rs:pick_program`),用单引号转义路径(`shell_quote`)。
- **Windows**: 直接走 PowerShell 或 cmd 链路(`pick_program` 内分支)。
- 主窗口在 `tauri.conf.json` 里设的 `decorations: false`,顶栏由 Solid 自绘——改顶栏要同时考虑两个平台的拖拽区(`-webkit-app-region: drag`)。

## 还没做但已知的事

- 没有自动化测试。任何"测试 X"的指令目前只能靠手动跑 `pnpm tauri dev` 验证。
- App.tsx 单文件 >2600 行,拆分计划见 [FRONTEND.md](FRONTEND.md#拆分路线)。
