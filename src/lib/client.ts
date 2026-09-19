import { createClient } from "@supabase/supabase-js";
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://hbuqzdmjqvgybwohfnqy.supabase.co";
export const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_zoRbvS06zi6X4_shxXQkMg_O7h0Go6r";
export const client = createClient(supabaseUrl, publishableKey, {
  global: {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      }),
  },
  auth: {
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
