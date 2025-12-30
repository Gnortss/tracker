// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {}
    interface PageData {}
    interface Platform {
      env?: {
        DB?: D1Database;
        API_TOKEN?: string;
        DEFAULT_TZ?: string;
        ALLOWED_ORIGINS?: string;
      };
    }
  }
}

export {};
