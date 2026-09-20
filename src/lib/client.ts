import { createClient } from "@supabase/supabase-js";
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://hbuqzdmjqvgybwohfnqy.supabase.co";
export const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_zoRbvS06zi6X4_shxXQkMg_O7h0Go6r";
export const client = createClient(supabaseUrl, publishableKey, {
  global: {
    fetch: (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const timeout = url.includes("/storage/v1/") ? 120000 : 15000;
      return fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)])
          : AbortSignal.timeout(timeout),
      });
    },
  },
  auth: {
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
