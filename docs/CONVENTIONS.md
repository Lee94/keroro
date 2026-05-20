# Conventions

下笔前的硬约束。违反这些的 PR 会被打回——它们存在的原因都基于已经踩过的坑或明确的设计选择。

## TypeScript / Solid

**ESM only**——`package.json` 有 `"type": "module"`,不要 `require()`。

**导入风格**:
- 相对路径用 `./xxx`,不要写 `.tsx` 后缀。
- Tauri API 从 `@tauri-apps/api/core`(`invoke`)和 `@tauri-apps/api/event`(`listen`)分别导入,**不要**从 `@tauri-apps/api` 顶级导。
- 类型导入用 `import type { … }` —— Vite 在生产构建里会剥掉。

**响应性陷阱**:
- `props.xxx`、`signal()` 必须在 effect / JSX / `createMemo` 里访问才会追踪。
- 解构 props 会失去响应性:**禁用** `const { name } = props`。

**命名**:
- 组件 `PascalCase`,hook/工具 `camelCase`,常量 `UPPER_SNAKE`。
- 文件名:组件 `PascalCase.tsx`,模块 `camelCase.ts`(参见现有 `XtermPane.tsx` / `persistence.ts`)。
- Solid Context 后缀 `Context`(`ThemeContext`),hook 包装是 `useXxx`。

## Rust

**模块边界**:见 [BACKEND.md](BACKEND.md#模块边界)。

**错误**:命令签名一律 `Result<T, String>`。不 `panic!` / `unwrap` / `expect`(`lib.rs::run()` 结尾除外)。

**Tauri 命令命名**:Rust 用 `snake_case`,前端 invoke 字符串与之一致,TS wrapper 用 `camelCase`。

**`mod.rs` 还是 `xxx.rs`**:用 `xxx.rs`(平铺)。当前 `src-tauri/src/` 没有子目录,**别加**——5 个模块还没到需要分组的规模。

## 注释

默认**不写**注释。只在以下场景写,且**只一行**:

- 不显然的"为什么"(隐藏约束、规避的 bug、奇怪的 workaround)
  - 范例:`pty.rs:42` 解释为什么需要 shell-quote
  - 范例:`sys_info.rs:21` 解释为什么 macOS 要额外探测路径
- 公共 API 一行说明用法(rustdoc `///` / TSDoc `/** */`)

不写的内容:
- 解释"做什么"——好命名能说清的就别写
- 提到当前任务、当前 PR、issue 号——这些放 commit message / PR 描述
- "TODO: xxx" —— 用 issue,不要 TODO 注释

## 文件大小

| 文件类型 | 警戒 | 强制拆分 |
| --- | --- | --- |
| Solid 组件 | 400 行 | 600 行 |
| Rust 模块 | 300 行 | 500 行 |
| 工具/类型模块 | 150 行 | 250 行 |

`App.tsx` 是历史遗留(2669 行),已列入 [FRONTEND.md 拆分路线](FRONTEND.md#拆分路线-apptsx-太肥)。**新功能不许塞进去**——开新文件。

## Tab / 空格

- TypeScript / JavaScript:**2 空格**(沿用现有代码)。
- Rust:`cargo fmt` 默认(4 空格)。

## 分号 / 引号

- TS:有分号,双引号字符串(`"…"`),反引号只用于模板。
- Rust:`cargo fmt` 默认。

## 命令 / 包管理

- **包管理用 pnpm**——`pnpm-lock.yaml` 是权威。不要用 npm / yarn 添加依赖,锁文件冲突会很痛。
- 添加依赖前看一眼能不能不加——参考 OpenAI 文章里的 boring tech 原则,我们更倾向手写小工具而不是引入大包。
- 后端依赖加进 `src-tauri/Cargo.toml` 后跑一次 `cargo check` 确认能编。

## Git

- 提交信息英文 lowercase 起头,带类型前缀:`feat:`, `fix:`, `ci:`, `chore:`, `docs:`, `refactor:`(对齐现有 commit history)。
- 一次 commit 一件事。重命名 + 修改逻辑请拆两个 commit。
- 不 amend 已 push 的 commit;不 force-push 到 `master`。

## 安全 / 隐私边界

- 不在代码或日志里 print 项目路径以外的 cwd 内容、不读用户文件。
- PTY 子进程**不继承额外环境变量**——只继承父进程的,加变量前要明确说明为什么。
- DB 只存项目元信息,不存终端输出 / 用户输入。

## 提交前 checklist

- 跑 `pnpm tauri dev` 起得来,我手动过一遍我改的功能。
- 改了 `db.rs` 的 schema → 想清楚老用户的 DB 升级路径。
- 改了 Tauri 命令 → `lib.rs` 注册了,`persistence.ts` 加 wrapper 了。
- 改了 `App.tsx` → 没有让它继续涨。
- 文档没过期(本套文档里凡是引用了行号 / 文件 / 命令名的地方,我改动后都查过)。
