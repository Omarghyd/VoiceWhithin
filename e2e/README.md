# End-to-end tests

Playwright tests that run against the local dev server (`http://localhost:8080`).

## Prereqs

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

## Run

```bash
# Dev server must be running (bun run dev)
bunx playwright test --config e2e/playwright.config.ts
```

## Sign-in test

`e2e/signin.spec.ts` verifies that signing in completes and lands on the
post-auth destination without the user needing to press the browser Back
button (the glitch we shipped a fix for).

It signs in with an existing confirmed account provided via
`TEST_EMAIL` and `TEST_PASSWORD`. The test is skipped when either is
missing.

Env vars:

| Name           | Purpose                                       |
| -------------- | --------------------------------------------- |
| `BASE_URL`     | Override target origin (default `http://localhost:8080`) |
| `TEST_EMAIL`   | Existing confirmed account email (required)   |
| `TEST_PASSWORD`| Existing confirmed account password (required)|