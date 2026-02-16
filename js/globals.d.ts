/**
 * Global type declarations for NFG app
 * Extends Window and other globals used in JS files
 */

interface EnvConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

interface LucideModule {
  createIcons?: () => void;
}

declare global {
  interface Window {
    ENV?: EnvConfig;
    lucide?: LucideModule;
    reviewCallLink?: (callId: string) => Promise<void>;
    closeCallReviewModal?: () => void;
    linkCallToSite?: (callId: string, siteId: string) => Promise<void>;
    createNextActionTask?: (callId: string, actionText: string) => Promise<void>;
  }
}

export {};
