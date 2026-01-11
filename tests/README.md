# Testing Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run E2E tests
npm run test:e2e
```

## Test Structure

- `tests/fixtures/` - Test data factories
- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests
- `tests/e2e/` - End-to-end tests

## Environment Setup

Create a `.env` file (not committed) with:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Running Tests

### Unit Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

### E2E Tests

```bash
npm run test:e2e      # Headless
npm run test:e2e:ui   # With UI
```

### All Checks

```bash
npm run ci            # Lint + typecheck + tests
```

## Writing Tests

### Using Factories

```javascript
import { createTestUser, createTestSite } from '../fixtures/factories.js'

const user = await createTestUser({ role: 'client' })
const site = await createTestSite(user.auth.id)
```

### Cleanup

Always clean up test data:

```javascript
afterAll(async () => {
  await cleanupTestData({
    userIds: [user.auth.id],
    siteIds: [site.id]
  })
})
```

## CI/CD

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests

All checks must pass before merge.
