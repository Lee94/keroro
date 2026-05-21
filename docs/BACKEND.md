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
- `db.rs` 中 `ProjectRow / SessionRow` 字段顺序与 `persistence.ts` 一致
- `app_data_dir` 下的 DB 文件名 `keroro.db`

要改这些先在 PR 描述里说清楚迁移路径。
