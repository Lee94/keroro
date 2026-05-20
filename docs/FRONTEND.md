# Frontend

Solid.js 1.9 + TypeScript 5.6 + Vite 6 + xterm.js 6。无路由库、无状态库、无 CSS 框架——所有样式手写内联在组件里。

## 文件职责

| 文件 | 职责 | 容量警戒线 |
| --- | --- | --- |
| `App.tsx` | 顶栏、侧栏、布局树渲染、Tab 拖拽、主题切换、项目/会话生命周期 | **已 2669 行**,见下方拆分路线 |
| `XtermPane.tsx` | 单个 xterm 实例 + FitAddon + WebLinksAddon,绑定 PTY 事件 | 200 行内 |
| `persistence.ts` | Tauri 命令的 typed wrapper + `debounce` 工具 | 150 行内 |
| `terminalHost.ts` | xterm 实例复用池(避免 pane 重渲染时销毁终端) | 50 行内 |
| `themes.ts` | 4 套主题色板 + `rad()`(borderRadius 缩放) | 200 行内 |
| `themeContext.ts` | Solid `createContext` 定义:Theme / Workspace / 已装 CLI 列表 | 50 行内 |
| `mascots.tsx` | 7 个像素吉祥物 SVG 组件 | 300 行内 |
| `index.tsx` | 仅 `render(App, root)` | 10 行内 |

## Solid 用法约定

- **永远不要** 在 JSX 里直接展开 store(`{...state}`)——会丢响应性。  
- 列表用 `<For>` 而不是 `{arr.map}`,条件用 `<Show>` / `<Switch>`。  
- 副作用:`createEffect` 用于"响应到变化",`onMount` 用于"挂载时跑一次",`onCleanup` 用于解绑。  
- DOM 操作用 `ref={el => …}`,不要用 `document.getElementById`。  

## 状态:就地 `createSignal`,跨组件用 Context

目前没有引入 store 库。跨组件状态走 Solid Context(见 `themeContext.ts`):

- `ThemeContext` — 当前主题
- `WorkspaceContext` — 当前项目 + 切换函数
- `WorkspaceInfoContext` — 项目元信息(node 版本、git branch)
- `InstalledClisContext` — 已检测到的 CLI 列表
- `DragContext`(定义在 `App.tsx` 内) — Tab 拖拽源

新加全局态前**先想想能不能就近放**——多个 Context 比一个 mega-store 容易理解和拆分。

## 布局树

- 数据结构:`LayoutNode = LayoutSplit | LayoutLeaf`(`persistence.ts:21-35`)。
- `split` 有 `direction`(horizontal/vertical)、`ratio`(0..1)、`first` / `second` 子节点。
- `leaf` 持有 `tabIds: string[]` 和 `activeTabId`。
- 树持久化:JSON 字符串写入 `project_layouts.tree_json`,**前端是唯一权威**,后端不解析。
- 任意修改后调用 debounced `setLayout` 写回 DB(避免每次拖动都写)。

拖拽 split 的 MIME 是 `TAB_DRAG_MIME = "application/x-faye-tab"`。`computeDropSide` 决定落点是上下左右还是合并到同一 leaf。

## xterm 集成要点

- 每个 `XtermPane` 在 `onMount` 调 `pty_spawn`,得到 `pty_id`。
- 监听 `pty:{id}:data`(base64 字节)写入 terminal,监听 `pty:{id}:exit` 标记终止。
- 主题切换时**重新构造** `xtermTheme(theme)` 并赋给 `term.options.theme`。
- 字号、字体、行高写死在 `XtermPane.tsx` 里——改前看一眼是否需要同步加到 `themes.ts`。
- `terminalHost.ts` 实现了 instance 复用:同一个 `paneId` 的 xterm 在 pane 移动时不会被销毁/重建,避免历史滚动丢失。**改 pane 销毁逻辑时必须配合 `releaseTerminalHost`**。

## 拖拽到底要不要触发拆分

- 落到 leaf 中心 → 合并 tab。
- 落到边缘(`computeDropSide` 返回 top/right/bottom/left)→ 创建新 split,新 leaf 放新 tab。
- 拖出窗口外 → 不处理(没有"独立窗口"特性)。

## 主题

- 4 套主题:`ember`(暖橙)、`forest`(墨绿)、`plum`(紫)、`zed`(浅色)。
- `cornerScale` 控制圆角倍率:Zed 用 0(直角),其他用 1。新增主题时**必须**给齐 `Theme` 接口的所有字段——TypeScript 会报错。
- 颜色变量命名:`bg / chrome / panel*`(背景层),`border*`(边),`text*`(前景),`accent*`(强调),`amber/green/blue/yellow/red`(语义色),`pixel*`(吉祥物专用)。
- 不要在组件里硬编码 hex 颜色——所有颜色都应该取自 `useTheme()`。

## CSS

- 样式 100% 内联(`style={{ … }}`)。
- 唯一全局表是 `App.css`(应保持精简)和 `@xterm/xterm/css/xterm.css`(第三方,别动)。
- 不引 Tailwind / styled-components。

## 拆分路线(`App.tsx` 太肥)

短期目标:把 `App.tsx` 砍到 800 行以内。建议拆出的模块(改之前先开 issue 或 PR 讨论):

- `src/layout/` — `LayoutNode` 渲染、Pane、Split 调整、拖拽逻辑
- `src/sidebar/` — 项目列表、添加/删除/排序
- `src/topbar/` — 窗口控件、项目切换、主题切换
- `src/tabs/` — Tab 渲染、Tab 拖拽 MIME
- `src/session/` — 创建会话(spawn CLI 或 shell)的胶水逻辑

拆的时候**保持现有 IPC 调用全部走 `persistence.ts`**,不允许新文件再直接 `invoke()`(`XtermPane.tsx` 那条性能路径除外)。
