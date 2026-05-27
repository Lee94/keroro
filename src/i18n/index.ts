import { createContext, useContext, type Accessor } from "solid-js";

export type Locale = "en" | "zh";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];

interface Dict {
  // Titlebar
  hideSidebar: string;
  showSidebar: string;
  newProjectTooltip: string;
  newProjectLabel: string;
  tweaksLabel: string;
  tasksLabel: string;
  tasksTooltip: string;
  // Sidebar
  removeProject: string;
  removeProjectConfirmTitle: string;
  removeProjectConfirmBody: string;
  closeTerminal: string;
  confirmCancel: string;
  confirmDelete: string;
  sidebarEmptyTitle: string;
  sidebarEmptyHintPrefix: string;
  sidebarEmptyHintButton: string;
  sidebarEmptyHintSuffix: string;
  // Empty workspace
  pickFolder: string;
  noFolderOpen: string;
  openFolder: string;
  // Pane empty leaf
  newTerminalButton: string;
  dragTabHint: string;
  // Tweaks panel
  tweaksTitle: string;
  palette: string;
  themeAnthropicDark: string;
  themeAnthropicLight: string;
  themeOpenAIDark: string;
  themeOpenAILight: string;
  themeZedDark: string;
  themeZedLight: string;
  themeGitHubDark: string;
  themeGitHubLight: string;
  density: string;
  densityCozy: string;
  densityCompact: string;
  language: string;
  terminalFont: string;
  terminalFontFamily: string;
  fontSystemDefault: string;
  fontNotInstalled: string;
  shrinkFontTooltip: string;
  resetFontTooltip: string;
  enlargeFontTooltip: string;
  // Tab add menu
  addMenuTerminal: string;
  // Command palette
  commandPalettePlaceholder: string;
  commandPaletteEmpty: string;
  commandPaletteNoTabs: string;
  // Runtime
  processExited: string;
  spawnFailed: string;
  resumeFailedRetrying: string;
  sessionUnlockedResuming: string;
  degradedToShellSuffix: string;
  // Terminal search
  searchPlaceholder: string;
  searchPrev: string;
  searchNext: string;
  searchClose: string;
  searchNoMatches: string;
  // Updater
  updateAvailableLabel: string;
  updateDownloading: string;
  updateReady: string;
  updateInstall: string;
  updateLater: string;
  updateCheckButton: string;
  updateChecking: string;
  updateUpToDate: string;
  updateErrorPrefix: string;
  // Sidebar — collapsible groups
  sidebarExpandProject: string;
  sidebarCollapseProject: string;
  sidebarTerminalsSection: string;
  sidebarCommandsSection: string;
  sidebarCommandsEmpty: string;
  // Project commands
  commandAddTooltip: string;
  commandEdit: string;
  commandDelete: string;
  commandRun: string;
  commandRunning: string;
  commandViewOutput: string;
  commandStop: string;
  commandRerun: string;
  commandOutputTitle: string;
  commandEditorNew: string;
  commandEditorEdit: string;
  commandEditorTitleLabel: string;
  commandEditorTitlePlaceholder: string;
  commandEditorShellLabel: string;
  commandEditorShellPlaceholder: string;
  commandEditorSave: string;
  commandEditorCancel: string;
  commandStatusIdle: string;
  commandStatusRunning: string;
  commandStatusSuccess: string;
  commandStatusFailed: string;
  commandStatusKilled: string;
  commandExitCodePrefix: string;
  commandNoOutput: string;
  // Tasks panel
  tasksTitle: string;
  tasksEmpty: string;
  tasksColSession: string;
  tasksColCpu: string;
  tasksColMemory: string;
  tasksExited: string;
  tasksKill: string;
  tasksKillTooltip: string;
  // External editors (project status bar)
  openInEditorLabel: string;
  openInEditorTooltip: string;
  openInEditorEmpty: string;
  editorZed: string;
  editorVscode: string;
  editorCursor: string;
  openInEditorFailed: string;
}

const en: Dict = {
  hideSidebar: "Hide sidebar",
  showSidebar: "Show sidebar",
  newProjectTooltip: "New project",
  newProjectLabel: "new project",
  tweaksLabel: "tweaks",
  tasksLabel: "tasks",
  tasksTooltip: "Running sessions",
  removeProject: "Remove project",
  removeProjectConfirmTitle: "Remove this project?",
  removeProjectConfirmBody:
    "“{name}” will be removed from the sidebar along with its terminals and commands. The folder on disk is left untouched.",
  closeTerminal: "Close terminal",
  confirmCancel: "Cancel",
  confirmDelete: "Remove",
  sidebarEmptyTitle: "No folders yet.",
  sidebarEmptyHintPrefix: "Use ",
  sidebarEmptyHintButton: "+ new project",
  sidebarEmptyHintSuffix: " in the toolbar.",
  pickFolder: "Pick a folder from the sidebar",
  noFolderOpen: "No folder open",
  openFolder: "Open folder",
  newTerminalButton: "New terminal",
  dragTabHint: "or drag a tab here from another pane",
  tweaksTitle: "Tweaks",
  palette: "Palette",
  themeAnthropicDark: "Anthropic Dark",
  themeAnthropicLight: "Anthropic Light",
  themeOpenAIDark: "OpenAI Dark",
  themeOpenAILight: "OpenAI Light",
  themeZedDark: "Zed Dark",
  themeZedLight: "Zed Light",
  themeGitHubDark: "GitHub Dark",
  themeGitHubLight: "GitHub Light",
  density: "Density",
  densityCozy: "Cozy",
  densityCompact: "Compact",
  language: "Language",
  terminalFont: "Terminal font",
  terminalFontFamily: "Terminal font family",
  fontSystemDefault: "System default",
  fontNotInstalled: "(not installed)",
  shrinkFontTooltip: "Shrink (Cmd/Ctrl -)",
  resetFontTooltip: "Reset (Cmd/Ctrl 0)",
  enlargeFontTooltip: "Enlarge (Cmd/Ctrl =)",
  addMenuTerminal: "Terminal",
  commandPalettePlaceholder: "Go to tab…",
  commandPaletteEmpty: "No matching tabs",
  commandPaletteNoTabs: "No open tabs",
  processExited: "[process exited]",
  spawnFailed: "failed to spawn pty",
  resumeFailedRetrying: "[resume failed — starting a fresh session]",
  sessionUnlockedResuming: "[unlocked stale session — resuming with history]",
  degradedToShellSuffix: " — shell",
  searchPlaceholder: "Search terminal",
  searchPrev: "Previous match (Shift+Enter)",
  searchNext: "Next match (Enter)",
  searchClose: "Close (Esc)",
  searchNoMatches: "No matches",
  updateAvailableLabel: "Update available",
  updateDownloading: "Downloading update…",
  updateReady: "Update ready — restarting…",
  updateInstall: "Install & Restart",
  updateLater: "Later",
  updateCheckButton: "Check for updates",
  updateChecking: "Checking…",
  updateUpToDate: "You're up to date",
  updateErrorPrefix: "Update check failed:",
  sidebarExpandProject: "Expand",
  sidebarCollapseProject: "Collapse",
  sidebarTerminalsSection: "Terminals",
  sidebarCommandsSection: "Commands",
  sidebarCommandsEmpty: "No commands yet",
  commandAddTooltip: "Add command",
  commandEdit: "Edit",
  commandDelete: "Delete command",
  commandRun: "Run",
  commandRunning: "Running…",
  commandViewOutput: "View output",
  commandStop: "Stop",
  commandRerun: "Re-run",
  commandOutputTitle: "Command output",
  commandEditorNew: "New command",
  commandEditorEdit: "Edit command",
  commandEditorTitleLabel: "Label (optional)",
  commandEditorTitlePlaceholder: "e.g. start dev server",
  commandEditorShellLabel: "Shell command",
  commandEditorShellPlaceholder: "e.g. npm run dev",
  commandEditorSave: "Save",
  commandEditorCancel: "Cancel",
  commandStatusIdle: "Idle",
  commandStatusRunning: "Running",
  commandStatusSuccess: "Succeeded",
  commandStatusFailed: "Failed",
  commandStatusKilled: "Stopped",
  commandExitCodePrefix: "exit",
  commandNoOutput: "(no output yet)",
  tasksTitle: "Running sessions",
  tasksEmpty: "No active sessions",
  tasksColSession: "Session",
  tasksColCpu: "CPU",
  tasksColMemory: "Memory",
  tasksExited: "exited",
  tasksKill: "Kill",
  tasksKillTooltip: "Force-kill this session and its child processes",
  openInEditorLabel: "Open in editor",
  openInEditorTooltip: "Open this project in an external editor",
  openInEditorEmpty: "No editor CLI found on PATH (zed / code / cursor)",
  editorZed: "Zed",
  editorVscode: "VS Code",
  editorCursor: "Cursor",
  openInEditorFailed: "Failed to launch editor:",
};

const zh: Dict = {
  hideSidebar: "隐藏侧栏",
  showSidebar: "显示侧栏",
  newProjectTooltip: "新建项目",
  newProjectLabel: "新建项目",
  tweaksLabel: "设置",
  tasksLabel: "任务",
  tasksTooltip: "运行中的会话",
  removeProject: "移除项目",
  removeProjectConfirmTitle: "移除该项目？",
  removeProjectConfirmBody:
    "“{name}” 将从侧栏移除，相关终端与命令也会一并清理。本地文件夹不会被删除。",
  closeTerminal: "关闭终端",
  confirmCancel: "取消",
  confirmDelete: "移除",
  sidebarEmptyTitle: "还没有项目。",
  sidebarEmptyHintPrefix: "请点击工具栏中的 ",
  sidebarEmptyHintButton: "+ 新建项目",
  sidebarEmptyHintSuffix: "。",
  pickFolder: "请从侧栏选择一个项目",
  noFolderOpen: "暂未打开项目",
  openFolder: "打开文件夹",
  newTerminalButton: "新建终端",
  dragTabHint: "或从其他面板拖入标签页",
  tweaksTitle: "设置",
  palette: "主题",
  themeAnthropicDark: "Anthropic 深色",
  themeAnthropicLight: "Anthropic 浅色",
  themeOpenAIDark: "OpenAI 深色",
  themeOpenAILight: "OpenAI 浅色",
  themeZedDark: "Zed 深色",
  themeZedLight: "Zed 浅色",
  themeGitHubDark: "GitHub 深色",
  themeGitHubLight: "GitHub 浅色",
  density: "密度",
  densityCozy: "宽松",
  densityCompact: "紧凑",
  language: "语言",
  terminalFont: "终端字号",
  terminalFontFamily: "终端字体",
  fontSystemDefault: "系统默认",
  fontNotInstalled: "（未安装）",
  shrinkFontTooltip: "缩小 (Cmd/Ctrl -)",
  resetFontTooltip: "重置 (Cmd/Ctrl 0)",
  enlargeFontTooltip: "放大 (Cmd/Ctrl =)",
  addMenuTerminal: "终端",
  commandPalettePlaceholder: "跳转到标签页…",
  commandPaletteEmpty: "没有匹配的标签页",
  commandPaletteNoTabs: "暂无打开的标签页",
  processExited: "[进程已退出]",
  spawnFailed: "终端启动失败",
  resumeFailedRetrying: "[恢复会话失败，正在创建新会话]",
  sessionUnlockedResuming: "[已解锁僵尸会话，正在恢复原对话]",
  degradedToShellSuffix: " — shell",
  searchPlaceholder: "搜索终端",
  searchPrev: "上一处 (Shift+Enter)",
  searchNext: "下一处 (Enter)",
  searchClose: "关闭 (Esc)",
  searchNoMatches: "无匹配",
  updateAvailableLabel: "发现新版本",
  updateDownloading: "正在下载更新…",
  updateReady: "已就绪 — 即将重启…",
  updateInstall: "安装并重启",
  updateLater: "稍后",
  updateCheckButton: "检查更新",
  updateChecking: "检查中…",
  updateUpToDate: "已是最新版本",
  updateErrorPrefix: "检查更新失败：",
  sidebarExpandProject: "展开",
  sidebarCollapseProject: "收起",
  sidebarTerminalsSection: "终端",
  sidebarCommandsSection: "命令",
  sidebarCommandsEmpty: "暂无命令",
  commandAddTooltip: "添加命令",
  commandEdit: "编辑",
  commandDelete: "删除命令",
  commandRun: "运行",
  commandRunning: "运行中…",
  commandViewOutput: "查看输出",
  commandStop: "停止",
  commandRerun: "重新运行",
  commandOutputTitle: "命令输出",
  commandEditorNew: "新建命令",
  commandEditorEdit: "编辑命令",
  commandEditorTitleLabel: "名称（可选）",
  commandEditorTitlePlaceholder: "例如：启动开发服务器",
  commandEditorShellLabel: "Shell 命令",
  commandEditorShellPlaceholder: "例如：npm run dev",
  commandEditorSave: "保存",
  commandEditorCancel: "取消",
  commandStatusIdle: "空闲",
  commandStatusRunning: "运行中",
  commandStatusSuccess: "成功",
  commandStatusFailed: "失败",
  commandStatusKilled: "已停止",
  commandExitCodePrefix: "退出码",
  commandNoOutput: "（暂无输出）",
  tasksTitle: "运行中的会话",
  tasksEmpty: "暂无运行中的会话",
  tasksColSession: "会话",
  tasksColCpu: "CPU",
  tasksColMemory: "内存",
  tasksExited: "已退出",
  tasksKill: "终止",
  tasksKillTooltip: "强制终止该会话及其所有子进程",
  openInEditorLabel: "在编辑器中打开",
  openInEditorTooltip: "用外部编辑器打开当前项目",
  openInEditorEmpty: "未在 PATH 中找到编辑器 CLI（zed / code / cursor）",
  editorZed: "Zed",
  editorVscode: "VS Code",
  editorCursor: "Cursor",
  openInEditorFailed: "启动编辑器失败：",
};

export type DictKey = keyof Dict;

const dicts: Record<Locale, Dict> = { en, zh };

const defaultLocale: Accessor<Locale> = () => "en";

export const LocaleContext = createContext<Accessor<Locale>>(defaultLocale);

export const useT = () => {
  const locale = useContext(LocaleContext);
  return (key: DictKey): string => dicts[locale()][key];
};

export const translate = (locale: Locale, key: DictKey): string =>
  dicts[locale][key];

export const detectDefaultLocale = (): Locale => {
  try {
    const nav = typeof navigator !== "undefined" ? navigator.language : "";
    if (nav && nav.toLowerCase().startsWith("zh")) return "zh";
  } catch {}
  return "en";
};
