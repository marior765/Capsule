import { StyleSheet } from "react-native-unistyles";
import { Colors, Fonts, Spacing } from "./theme";

const fonts = Fonts ?? {
  sans: "normal",
  serif: "serif",
  rounded: "normal",
  mono: "monospace",
};

const lightTheme = {
  colors: Colors.light,
  spacing: Spacing,
  fonts,
} as const;

const darkTheme = {
  colors: Colors.dark,
  spacing: Spacing,
  fonts,
} as const;

type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

declare module "react-native-unistyles" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  settings: {
    adaptiveThemes: true,
  },
});
