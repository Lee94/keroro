import { createContext, type Accessor } from "solid-js";
import { THEMES, type Theme } from "./themes";

export const ThemeContext = createContext<() => Theme>(() => THEMES.ember);

export const WorkspaceContext = createContext<() => string | undefined>(
  () => undefined,
);

export interface WorkspaceInfo {
  node: Accessor<string | null>;
  branch: Accessor<string | null>;
}

export const WorkspaceInfoContext = createContext<WorkspaceInfo>({
  node: () => null,
  branch: () => null,
});
