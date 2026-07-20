# Design tokens

Vanilla, Alpine, and Web Component built-in UI uses the same `--verino-*` custom
properties. The defaults use Creed colors. Override tokens on the
wrapper (`.verino-wrapper` / the `x-verino` element) or on `<verino-input>`.

## Field and slot

| Token | Default | Purpose |
| --- | --- | --- |
| `--verino-size` | `56px` | Slot width and height |
| `--verino-gap` | `12px` | Space between slots |
| `--verino-content-padding-top` | `24px` (`0px` in Alpine) | Space above the slot row |
| `--verino-border-width` | `1px` | Slot border width |
| `--verino-radius` | `10px` | Slot radius |
| `--verino-font-size` | `24px` | Entered character size |
| `--verino-font-weight` | `600` | Entered character weight |
| `--verino-slot-font` | `inherit` | Slot font family |
| `--verino-bg` | `#FAFAFA` | Empty slot background |
| `--verino-bg-filled` | `#FFFFFF` | Filled slot background |
| `--verino-color` | `#0C0C0C` | Entered character color |
| `--verino-border-color` | `#DBDBDB` | Resting border |
| `--verino-active-color` | `#2A2A2A` | Focused border |
| `--verino-error-color` | `#FF3846` | Invalid border |
| `--verino-success-color` | `#00C65B` | Success border |
| `--verino-active-ring` | `0 0 0 3px rgba(42,42,42,.12)` | Focused ring |
| `--verino-error-ring` | `0 0 0 3px rgba(255,56,70,.12)` | Invalid ring |
| `--verino-success-ring` | `0 0 0 3px rgba(0,198,91,.12)` | Success ring |
| `--verino-disabled-opacity` | `.45` | Disabled slot opacity |
| `--verino-motion-duration` | `150ms` | UI transition duration |

## Caret, placeholder, separator, and mask

| Token | Default | Purpose |
| --- | --- | --- |
| `--verino-caret-color` | `#2A2A2A` | Caret color |
| `--verino-caret-width` | `2px` | Caret width |
| `--verino-caret-height` | `52%` | Caret height |
| `--verino-caret-radius` | `1px` | Caret radius |
| `--verino-caret-duration` | `1s` | Blink duration |
| `--verino-placeholder-color` | `#888888` | Empty placeholder color |
| `--verino-placeholder-size` | `16px` | Empty placeholder size |
| `--verino-separator-color` | `#B2B2B2` | Separator color |
| `--verino-separator-size` | `18px` | Separator size |
| `--verino-masked-size` | `16px` | Mask glyph size |

## Timer and resend

| Token | Default | Purpose |
| --- | --- | --- |
| `--verino-timer-color` | `#484848` | Timer/resend supporting text |
| `--verino-timer-font-size` | `14px` | Timer/resend text size |
| `--verino-timer-gap` | `8px` | Timer label-to-badge gap |
| `--verino-timer-spacing` | `20px` | Space above timer |
| `--verino-timer-badge-bg` | `rgba(255,56,70,.10)` | Timer badge background |
| `--verino-timer-badge-color` | error color | Timer badge text |
| `--verino-timer-badge-font-weight` | `500` | Timer badge weight |
| `--verino-timer-badge-height` | `24px` | Timer badge height |
| `--verino-pill-padding` | `2px 10px` | Badge/button inline padding |
| `--verino-pill-radius` | `99px` | Badge/button radius |
| `--verino-resend-gap` | `8px` | Resend prompt-to-button gap |
| `--verino-resend-spacing` | `20px` (`12px` in Web Component) | Space above resend row |
| `--verino-resend-bg` | `#F4F4F4` | Resend button background |
| `--verino-resend-hover-bg` | `#E6E6E6` | Resend hover background |
| `--verino-resend-disabled-bg` | `#F4F4F4` | Disabled resend background |
| `--verino-resend-color` | `#0C0C0C` | Resend button text |
| `--verino-resend-disabled-color` | `#B2B2B2` | Disabled resend text |
| `--verino-resend-font-weight` | `500` | Resend button weight |
| `--verino-resend-height` | `24px` | Resend button height |

Ring tokens accept a complete `box-shadow`, making them compatible with solid,
alpha, or multi-layer design-system shadows without requiring `color-mix()`.
