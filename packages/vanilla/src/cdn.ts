/**
 * verino CDN entry point
 * ─────────────────────────────────────────────────────────────────────────────
 * Bundled by build-cdn.js via esbuild with globalName: 'Verino'.
 * Produces dist/verino.min.js which exposes window.Verino.
 *
 * Usage via CDN:
 *   <script src="https://unpkg.com/verino/dist/verino.min.js"></script>
 *   <script>
 *     const { init } = window.Verino
 *     const [otp] = init('.verino-wrapper', { length: 6, timer: 60 })
 *   </script>
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

export { initOTP as init } from './vanilla.js'
export { createOTP, filterChar, filterString, formatCountdown } from '@verino/core'
