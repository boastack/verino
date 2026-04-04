/** Public type facade for the `@verino/vanilla/plugins` entrypoint. */
import type { VerinoPlugin } from './plugins/types'

export type {
  VerinoPlugin,
  VerinoPluginContext,
  VerinoWrapper,
} from './plugins/types'

export declare const timerUIPlugin: VerinoPlugin
export declare const webOTPPlugin: VerinoPlugin
export declare const pmGuardPlugin: VerinoPlugin
