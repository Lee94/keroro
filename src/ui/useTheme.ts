import { useContext, type Accessor } from "solid-js";
import { ThemeContext } from "../themeContext";
import type { Theme } from "../themes";

// Call once during component setup to capture the theme accessor. The returned
// accessor works inside event handlers and other contexts without an owner —
// `useContext` itself only resolves the provider when invoked under one.
export const useTheme = (): Accessor<Theme> => useContext(ThemeContext);
