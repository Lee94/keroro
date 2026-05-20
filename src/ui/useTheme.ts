import { useContext } from "solid-js";
import { ThemeContext } from "../themeContext";

export const useTheme = () => useContext(ThemeContext)();
