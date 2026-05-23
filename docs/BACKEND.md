# Backend (Rust + Tauri)

Tauri 2 + Rust edition 2021。后端职责清单:

- 启动 PTY 子进程,把字节流推给前端(`pty.rs`)
- 维护 SQLite 数据库(`db.rs`)
- 探测系统状态:CLI 是否存在、node 版本、git 分支/状态(`sys_info.rs`)
- 计算 Claude Code 会话恢复参数(`claude.rs`)
- 注册所有 Tauri 命令(`lib.rs`)

## 模块边界

| 模块 | 拥有的状态 | 不该越界做的事 |
| --- | --- | --- |
| `pty.rs` | `PtyManager` 持有所有活着的 PTY 会话 | 不读 DB、不知道项目/会话概念,只管 id↔进程映射 |
| `db.rs` | SQLite `Connection`(`Mutex` 包装) | 不启动进程、不知道 CLI 路径 |
| `claude.rs` | 无状态 | 不读 DB、不启动进程,只算路径和参数 |
| `sys_info.rs` | 无状态 | 不持久化探测结果——每次调用都重新探测 |
| `lib.rs` | Tauri builder | 不写业务逻辑,只做 wiring |

新命令默认放到现有最贴近的模块。**不要**为了一个命令开新模块。

## 添加一个新 Tauri 命令的流程

1. 在合适的 `*.rs` 里加 `#[tauri::command] pub fn xxx(...) -> Result<T, String>`。
2. 在 `src-tauri/src/lib.rs` 的 `tauri::generate_handler!` 数组里加 `module::xxx`。**漏了这一步,前端 invoke 会返回 "command not found"。**
3. 在 `src/persistence.ts` 加 typed wrapper:
   ```ts
   export const xxx = (args): Promise<T> => invoke<T>("xxx", { ... });
   ```
4. 命名转换:Rust `snake_case` ↔ 前端 invoke 字符串 `snake_case` ↔ TS wrapper `camelCase`。**Tauri 自动把命令参数对象的 key 从 camelCase 转 snake_case**——所以 TS 里写 `projectId` 对应 Rust 参数名 `project_id`。

## 错误处理约定

- 命令签名用 `Result<T, String>` 而不是自定义错误类型——前端只需要消息字符串。
- 转换:`.map_err(|e| format!("做什么时失败: {e}"))`,前缀写"做什么时失败",方便日志定位。
- 不 `panic!`、不 `unwrap()`、不 `expect()`——除了 `lib.rs:run()` 末尾那个 Tauri 自己要的 `expect`。
- 不存在的 SQLite 行用 `OptionalExtension::optional()` → `Result<Option<T>>`,**不要**靠 catch error。

## PTY 细节

- `portable-pty` 跨平台,但 shell 选择必须分平台(`pty.rs:pick_program`)。
- 字节流通过 `app.emit(format!("pty:{}:data", id), base64)` 推送。**编码必须是 base64**——Tauri 事件 payload 是 JSON,二进制要先编码。
- 子进程退出后必须发 `pty:{id}:exit` 然后从 `PtyManager` 移除——否则 `pty_kill` 会找不到。
- `shell_quote`(`pty.rs:44`)只对 POSIX shell 有效。Windows 走另一套引号规则,改的时候注意分支。

## SQLite 细节

- 启用 `journal_mode=WAL` 和 `foreign_keys=ON`——`open()` 里设置,**别在别处覆盖**。
- 所有写操作都在 `Mutex<Connection>` 锁内,无连接池。当前规模够用,如果未来加并发查询再说。
- 迁移策略:目前是"加列 + 忽略 duplicate column 错误"(见 `db.rs:58`)。改 schema 时:
  - 加字段:`ALTER TABLE ... ADD COLUMN`,容忍 `duplicate column` 错误。
  - 删字段 / 改类型:目前**没有**迁移基础设施——需要先引入版本号机制,讨论后再做。
- 时间戳用 `strftime('%s','now')` 存 unix 秒,不存 ISO 字符串。

## 探测命令的性能预算

`detect_*` 系列会被前端在切项目时调用。约定:

- `detect_git_branch` **直接读 `.git/HEAD` 文本**,不 fork `git` 子进程。理由:启动 git 进程在 macOS 上 ~50ms,叠加几个项目就很卡。
- `detect_git_status` 用 `git status --porcelain=v1 --branch` 拿分支/dirty 状态,再用 `git diff --numstat HEAD --` 拿新增/删除行数;前端按低频 interval 刷新。
- `detect_node_version` 不得不 fork `node --version`——可接受,因为切项目是低频。
- `detect_clis` 只查 PATH 和几个固定目录(`extra_lookup_paths`),不递归扫硬盘。

如果加新的探测,**预算同上**:能读文件就别开进程,能开一次就别开多次。

## 给 agent 看的接口冻结面

下面这些在没有充足理由前**不要改**——前端有多处假设它们的行为:

- `pty:{id}:data` / `pty:{id}:exit` 事件名格式
- `claude_spawn_args` 返回的两种形式(`["--resume", id]` / `["--session-id", id]`)
- `claude_session_title` 返回 `Option<String>`(`None` = 还没有用户消息;前端按此判断是否继续轮询)
- `db.rs` 中 `ProjectRow / SessionRow` 字段顺序与 `persistence.ts` 一致
- `app_data_dir` 下的 DB 文件名 `keroro.db`

要改这些先在 PR 描述里说清楚迁移路径。

## 集成一个新的 code CLI(claude / codex / 未来的 gemini / pi …)

新 CLI 接入要触达的点散落在前后端,清单按"必须 → 可选"排序:

### 必须

1. **探测**:`src-tauri/src/sys_info.rs:CLI_BINARIES` 加 `(kind, binary)` 元组——`detect_clis` 会自动用 `find_cli`(PATH + `extra_lookup_paths`)找它。`extra_lookup_paths` 是为 macOS .app 从 Finder 启动时 PATH 被剥光准备的,不要去掉。
2. **类型与注册表**:`src/panes/types.ts` 同步四处——`AgentKind` 联合、`CLI_REGISTRY`、`AGENT_LABEL`、`isAgentKind` 的窄化分支。漏一处会有运行时 / 类型错误。
3. **吉祥物 / 介绍页**:`src/panes/AgentMascot.tsx`、`src/agents/AgentContent.tsx` 各加一个 `<Match when={props.kind === "..."}>` 分支。
4. **spawn 命令**:`src/XtermPane.tsx` 是通用驱动,从 tab 的 `command`(对应 `CLI_REGISTRY.binary`)直接 spawn,不要在这里写 if-CLI 分支。

### 可选(看 CLI 自身能力)

5. **可恢复会话**:
   - 如果 CLI 像 Claude Code 那样把会话以 JSONL 落地,加一个类似 `claude_spawn_args` 的命令算 `--resume` vs `--session-id`。路径编码方案是 CLI 自家约定——Claude 的是"canonical 路径剥掉 Windows 的 `\\?\` 扩展前缀后,`/`/`\`/`:`/`.` 都替换成 `-`,放 `~/.claude/projects/<key>/<id>.jsonl`",别假设别家也这样。**Windows 上 `std::fs::canonicalize` 会带 `\\?\` 前缀,务必剥掉再编码**,否则查找路径全部错位——下游会一路把 `--resume` 退化成 `--session-id`、复用同一个已落地的 UUID,最终触发 `Session ID already in use` 的死循环。
   - 前端 `PaneView.tsx:handleAdd` 里新建 tab 时,如果 kind 支持会话,生成 `cliSessionId = crypto.randomUUID()` 存到 tab。默认标题来自 `defaultTabTitle(kind)`(`sessionTitles.ts`)——后续用户改名或自动标题填充都以这个值为基准判断"是否被改过"。
   - 把 `cliSessionId` 透传给 `XtermPane`;`XtermPane` 的 spawn 路径会读 `props.command` + `cliSessionId` 触发会话参数计算。
   - 自动恢复(两步):`XtermPane.tsx` 的 `rotateAndRespawn` 先尝试 `claude_unlock_session(originalId)`——后者扫 `~/.claude/sessions/*.json`,把那些 `pid` 已经不在的"僵尸"注册文件删掉(claude 启动写、正常退出删,被 `pty_kill` / 崩溃的进程会留下);如果删掉了就用 **原 sessionId** `--resume`,**保住对话历史**。只有 unlock 失败(没有僵尸文件,或注册的 pid 仍在跑——真冲突)时,才生成新 UUID 走 `--session-id`、丢历史。触发路径有两条:(a) PTY 退出且要么 `--resume` 快速失败(< 4s)、要么 buffer 里出现明确的会话冲突字串;(b) 实时数据流里扫到 `Session ID … already in use`(此路径不等 PTY 退出,因为该错误经常把 CLI 卡在非交互状态、不自然退出)。新增 CLI 时如果它有类似的 pid-based 锁机制,加一个并行的 `<cli>_unlock_session` 命令,在 `rotateAndRespawn` 里挂上。错误信息形态不同的,在 `tailLooksLikeSessionInUse` 旁边加同类的 buffer 扫描函数——别放宽快速退出阈值,后者会把正常的早期失败误判成会话冲突。
   - 自动标题:Claude 走 `claude_session_title` 读 JSONL 第一条用户消息。`XtermPane` 用 `createEffect` 轮询(5s 周期,命中即停),命中后写入 `sessionTitles` store;`TabBar` 用 `displayTabTitle(tab)` 渲染——只在 `tab.title === defaultTabTitle(kind)`(即用户没改过)时才用自动标题,改过则一直显示用户的命名。新 CLI 接入时:加一个并行的 `<cli>_session_title` 命令,在 `displayTabTitle` 的 kind 分支里挂上即可,不要把 JSONL 解析逻辑塞进 `claude.rs`。

6. **DB 字段**:`sessions.kind` 直接存 CLI 字符串。`sessions.cli_session_id` 已为可选 `TEXT`,无 CLI 会话能力的 kind 留 NULL 即可——不需要 schema 改动。

### 别做的事

- **别让 spawn 命令带 CLI 知识**:`pty_spawn` 拿到的是 `command + args`,后端不知道 / 不该知道 kind。所有"如果是 claude / codex 则…"的判断留在 `XtermPane.tsx` 之上。
- **别为新 CLI 开新 Rust 模块**:除非它带来一组真正新的命令(比如本地索引、状态同步)。单纯的探测和会话路径推断分别属于 `sys_info.rs` 和 `claude.rs`(后者已有先例,继续往里加同类小命令即可)。
- **Windows 子进程别忘 `CREATE_NO_WINDOW`**:任何 `Command::new` 在 Windows 上不加这个 flag,GUI 父进程每次 spawn 都会闪一帧黑色控制台。`sys_info.rs` 里有现成范例。
