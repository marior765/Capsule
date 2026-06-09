# Design

## Design Tokens

All tokens in `shared/ui/theme.ts`. **Never use raw values inline — always reference a token.**

### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `text` | `#000000` | `#ffffff` | Primary text |
| `textSecondary` | `#60646C` | `#B0B4BA` | Labels, captions, placeholders |
| `background` | `#ffffff` | `#000000` | Screen background |
| `backgroundElement` | `#F0F0F3` | `#212225` | Cards, inputs, sheets |
| `backgroundSelected` | `#E0E1E6` | `#2E3135` | Pressed / selected states |

### Spacing (4-point grid)

| Token | px |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `xxl` | 64 |

### Typography

System fonts via `Platform.select` — no custom font loading.

| Token | iOS | Android/default |
|---|---|---|
| `sans` | `system-ui` | `normal` |
| `serif` | `ui-serif` | `serif` |
| `rounded` | `ui-rounded` | `normal` |
| `mono` | `ui-monospace` | `monospace` |

### Layout constants

- `MaxContentWidth`: `800` — cap content width on large screens / web
- `BottomTabInset`: `50` iOS / `80` Android — padding above the tab bar
