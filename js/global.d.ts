// Global type declarations for browser globals and third-party libraries

declare global {
  interface Window {
    lucide?: {
      createIcons: () => void;
      [key: string]: any;
    };
    reviewCallLink?: (callId: string) => void;
    closeCallReviewModal?: () => void;
    linkCallToSite?: (callId: string, siteId: string) => void;
    ENV?: {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }
}

export {};
