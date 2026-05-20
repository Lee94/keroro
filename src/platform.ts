export const isWindows =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export const TitlebarHeight = isWindows ? 36 : 38;
