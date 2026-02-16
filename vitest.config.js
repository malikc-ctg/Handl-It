import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: [
      'node_modules',
      '**/rbac-compliance.test.js',  // Deno + imports js/supabase (https: CDN)
      '**/route-management.test.js' // Imports js/routes -> js/supabase (https: CDN)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'supabase/']
    }
  }
})
