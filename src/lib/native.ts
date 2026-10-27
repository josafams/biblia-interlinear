// The Android/iOS app (Capacitor): detection and plugins in one place. On the web every plugin is null.
type Plugin = Record<string, (...args: never[]) => Promise<unknown>>;
type Capacitor = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
  registerPlugin?: (name: string) => unknown;
};
declare global {
  interface Window {
    Capacitor?: Capacitor;
  }
}

const cap = typeof window !== "undefined" ? window.Capacitor : undefined;

export const isNative = !!cap?.isNativePlatform?.();
/** "android", "ios" or "web" */
export const platform = isNative ? cap?.getPlatform?.() || "web" : "web";

/** A Capacitor plugin, registered on first use when the app did not expose it yet. */
export function nativePlugin<T = Plugin>(name: string): T | null {
  if (!isNative || !cap) return null;
  return ((cap.Plugins && cap.Plugins[name]) || cap.registerPlugin?.(name) || null) as T | null;
}

/** A plugin only if the app exposes it (no registration): for plugins some builds do not include. */
export function exposedPlugin<T = Plugin>(name: string): T | null {
  return isNative ? ((cap?.Plugins?.[name] as T) ?? null) : null;
}

/** The public site: in the app the home page, videos and shared links point here. */
export { SITE_URL } from "./site";
