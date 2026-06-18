import { StyleSheet } from "react-native-unistyles";
import { Colors, Fonts, Spacing } from "./theme";

StyleSheet.configure({
  themes: {
    light: {
      colors: Colors.light,
      spacing: Spacing,
      fonts: Fonts ?? {
        sans: "normal",
        serif: "serif",
        rounded: "normal",
        mono: "monospace",
      },
    },
    dark: {
      colors: Colors.dark,
      spacing: Spacing,
      fonts: Fonts ?? {
        sans: "normal",
        serif: "serif",
        rounded: "normal",
        mono: "monospace",
      },
    },
  },
  settings: {
    adaptiveThemes: true,
  },
});
