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
  // Sidebar
  removeProject: string;
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
  themeEmber: string;
  themeForest: string;
  themePlum: string;
  themeZedLight: string;
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
  // Runtime
  processExited: string;
  spawnFailed: string;
  resumeFailedRetrying: string;
  sessionUnlockedResuming: string;
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
}

const en: Dict = {
  hideSidebar: "Hide sidebar",
  showSidebar: "Show sidebar",
  newProjectTooltip: "New project",
  newProjectLabel: "new project",
  tweaksLabel: "tweaks",
  removeProject: "Remove project",
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
  themeEmber: "Ember",
  themeForest: "Forest",
  themePlum: "Plum",
  themeZedLight: "Zed Light",
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
  processExited: "[process exited]",
  spawnFailed: "failed to spawn pty",
  resumeFailedRetrying: "[resume failed — starting a fresh session]",
  sessionUnlockedResuming: "[unlocked stale session — resuming with history]",
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
};

const zh: Dict = {
  hideSidebar: "隐藏侧栏",
  showSidebar: "显示侧栏",
  newProjectTooltip: "新建项目",
  newProjectLabel: "新建项目",
  tweaksLabel: "偏好",
  removeProject: "移除项目",
  sidebarEmptyTitle: "还没有项目。",
  sidebarEmptyHintPrefix: "请点击工具栏中的 ",
  sidebarEmptyHintButton: "+ 新建项目",
  sidebarEmptyHintSuffix: "。",
  pickFolder: "请从侧栏选择一个项目",
  noFolderOpen: "暂未打开项目",
  openFolder: "打开文件夹",
  newTerminalButton: "新建终端",
  dragTabHint: "或从其他面板拖入标签页",
  tweaksTitle: "偏好",
  palette: "主题",
  themeEmber: "余烬",
  themeForest: "森林",
  themePlum: "紫梅",
  themeZedLight: "Zed 浅色",
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
  processExited: "[进程已退出]",
  spawnFailed: "终端启动失败",
  resumeFailedRetrying: "[恢复会话失败，正在创建新会话]",
  sessionUnlockedResuming: "[已解锁僵尸会话，正在恢复原对话]",
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
};

export type DictKey = keyof Dict;

const dicts: Record<Locale, Dict> = { en, zh };

const defaultLocale: Accessor<Locale> = () => "en";

export const LocaleContext = createContext<Accessor<Locale>>(defaultLocale);

export const useLocale = (): Accessor<Locale> => useContext(LocaleContext);

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
