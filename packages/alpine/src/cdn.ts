/**
 * @verino/alpine CDN entry point
 * ─────────────────────────────────────────────────────────────────────────────
 * Bundled by build-cdn.js via esbuild → dist/verino-alpine.min.js.
 * Sets window.VerinoAlpine for direct use in script-tag setups.
 *
 * Usage:
 *   <script defer src="https://unpkg.com/alpinejs"></script>
 *   <script src="https://unpkg.com/@verino/alpine/dist/verino-alpine.min.js"></script>
 *   <script>
 *     document.addEventListener('alpine:init', () => Alpine.plugin(VerinoAlpine))
 *   </script>
 */

import { VerinoAlpine } from './index.js'

;(globalThis as Record<string, unknown>).VerinoAlpine = VerinoAlpine
