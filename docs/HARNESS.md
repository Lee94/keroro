# Harness

为什么 keroro 的文档要这么组织。这一页是 *元* 文档——给以后想改文档结构、加新约定的人(或 agent)看。

## 灵感来源

OpenAI 在 2026 年初公布了内部用 Codex agent 构建百万行产品的实践,把整套支撑 agent 工作的环境称为 **harness**(挽具):

> "在 agent-first 工作流里,代码本身是廉价的——agent 能批量产出。真正决定结果好坏的是 agent 工作所处的环境。"

挽具不会让马变快,但能让一匹快马朝有用的方向跑。文档、约定、命令注册表、构建脚本、CI、错误信息——这些**就是 keroro 的挽具**。

参考阅读:
- [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)

## 核心原则(翻译到 keroro 语境)

### 1. Agent Legibility(对 agent 可见)

agent 在跑的时候**只能看到 in-context 的东西**。Slack 里聊过的、口头同步过的、留在某人记忆里的——对它来说都不存在。

➜ 任何会影响下一次改动的事实必须落进 repo 的 markdown,而不是别处。

例子(本仓库):
- `db.rs:56-58` 的 `ALTER TABLE` 兜底为什么需要 → 写进 [BACKEND.md SQLite 细节](BACKEND.md#sqlite-细节)
- macOS .app 启动时 PATH 被剥光 → `sys_info.rs:21` 一行注释 + [BACKEND.md](BACKEND.md) 提及
- "前端只能通过 `persistence.ts` 调后端" → [ARCHITECTURE.md](ARCHITECTURE.md#分层) 写进契约,而不是靠 reviewer 记得提醒

### 2. Mechanical Enforcers(机械可检验,优于嘴上规则)

口号会被忽视,linter 不会。

➜ 任何"应该"的约束,理想情况下都要有机械手段验证。

现状:keroro 还**没有** lint / CI gate / 类型边界 / structural test。当前阶段先靠文档,以后逐步加机械化:

| 想做的检查 | 实现方式(未来) |
| --- | --- |
| 前端禁止在 `persistence.ts` 之外 `invoke()` | ESLint custom rule 或 grep gate |
| Tauri 命令必须在 `lib.rs` 注册 | Rust 端 build script 扫 `#[tauri::command]` 与 handler 数组对比 |
| `App.tsx` 不准变更大 | CI 检查行数上限 |

这些**没做**,所以现阶段在 `docs/CONVENTIONS.md` 里明确写规则、PR 里人工把关。

### 3. Plans/Docs as First-Class Artifacts(文档与计划是一等公民)

OpenAI 让 agent 写 plan.md → 实施 → 标记 done。计划不是 issue 里的字段,是 repo 里的 markdown。

➜ 任何不止一次改动的项目(比如"拆分 App.tsx")开一份 `docs/plans/<short-slug>.md`,在里面跟踪进度、决策、todo。完成后归档到 `docs/plans/completed/`。

当前还没启用,等第一个跨多次提交的任务出现时落地。

### 4. Boring Tech > Trendy Wrapper

OpenAI 团队会反复选择"被 LLM 训练数据广泛覆盖、API 稳定"的技术,有时甚至自己重写一份小工具而不是引入复杂依赖。

➜ keroro 已经在沿着这条线走:
- 没用状态库(用 Solid Context)
- 没用 CSS-in-JS / Tailwind(手写 `style={…}`)
- 没用 ORM(`rusqlite` 直接 SQL)
- `terminalHost.ts` 自己写了 ~24 行实例池,而不是引一个 pool 库

加新依赖前,问一遍:**手写 20 行能不能干?**

### 5. Repository as System of Record

仓库是事实的唯一来源。**架构、契约、决策、踩坑教训都在 `docs/` 里**——不在 Notion、不在 Linear、不在飞书。

➜ 如果你(人或 agent)发现某个事实不在 repo 里,把它**写进来**——比丢一个 PR 评论更有价值。

## 文档反模式(发现就该删/改)

- **过期的命令清单**:列了 5 个 Tauri 命令,实际有 18 个。→ 改成"权威定义在 `lib.rs:21-40`"+ 摘要。
- **空洞的口号**:"代码要清晰可读"。→ 删掉或换成具体规则("Solid 组件警戒线 400 行")。
- **不可验证的承诺**:"加新命令前要 review"。→ 换成机械化检查清单 / 走 PR template。
- **重复**:多份文档讲同一件事。→ 一份权威 + 别处链接过去。
- **包罗万象的 AGENTS.md**:5000 行什么都写。→ AGENTS.md 永远是目录页(<150 行),内容放 `docs/`。

## 加新规则的姿势

发现一条**未来会反复需要的事实** → 决定它属于哪份文档 → 加进去 → 如果重要到值得机械化,**同时**开 issue 描述未来的 linter / gate。

不要在 commit message 里写"以后大家注意 X" —— 那条信息一周内就找不到了。

## 缩减,而不是扩张

文档膨胀本身就是反模式。每加一段问:**这是 agent 下次改动必须看到的吗?如果不是,扔掉。**
