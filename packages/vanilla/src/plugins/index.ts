/**
 * verino/plugins
 * ─────────────────────────────────────────────────────────────────────────────
 * Barrel re-export of all built-in vanilla adapter plugins and their public
 * types. Tree-shake individual plugins via deep imports if you only need one:
 *   import { timerUIPlugin } from 'verino/plugins/timer-ui'
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

export type { VerinoPlugin, VerinoPluginContext, VerinoWrapper } from './types.js'
export { timerUIPlugin }  from './timer-ui.js'
export { webOTPPlugin }   from './web-otp.js'
export { pmGuardPlugin }  from './pm-guard.js'
