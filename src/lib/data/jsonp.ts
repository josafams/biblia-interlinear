// The data files in dados/ are scripts that call a global (`__cap("GEN.1", {...})`), so they load with a <script>
// tag over http://, in the Android/iOS app and from the disk alike. A channel owns one of those globals.
export type ChannelName = "__cap" | "__txt" | "__lex" | "__conc" | "__busca";

type Callback<T> = (key: string, data: T) => void;
declare global {
  interface Window {
    __cap?: Callback<unknown>;
    __txt?: Callback<unknown>;
    __lex?: Callback<unknown>;
    __conc?: Callback<unknown>;
    __busca?: Callback<unknown>;
  }
}

/**
 * Registers `window[name]`: every file that calls it is handed to `keep`, and the load waiting for that key
 * resolves. Returns the function that loads one file.
 */
export function jsonpChannel<T>(name: ChannelName, keep: Callback<T>) {
  const pending = new Map<string, (data: T) => void>();
  window[name] = ((key: string, data: T) => {
    keep(key, data);
    pending.get(key)?.(data);
    pending.delete(key);
  }) as Callback<unknown>;

  return function load(key: string, src: string) {
    return new Promise<T>((ok, fail) => {
      pending.set(key, ok);
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => s.remove();
      s.onerror = () => {
        pending.delete(key);
        s.remove();
        fail(new Error(`failed to load ${src}`));
      };
      document.head.appendChild(s);
    });
  };
}
