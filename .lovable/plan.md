## Goal

Simplify `e2e/signin.spec.ts` to always use `TEST_EMAIL` / `TEST_PASSWORD` from the environment. Drop the fresh-signup fallback path.

## Changes

**`e2e/signin.spec.ts`**
- Remove `randomEmail()`, the signup branch, the "check your inbox" handling, and the sign-out + re-sign-in second pass.
- Read `TEST_EMAIL` and `TEST_PASSWORD` at the top of the test. If either is missing, `test.skip(true, "Set TEST_EMAIL and TEST_PASSWORD to run this test.")`.
- Flow: `goto("/auth?next=%2Fonboarding")` → if the "Already have an account" toggle is visible click it → fill email + password → click **Sign in** → `expectLandedPostAuth(page)`.
- Keep `expectLandedPostAuth` unchanged (URL is `/onboarding` or `/studio`, "Taking you there…" heading gone, email input gone).

**`e2e/README.md`**
- Mark `TEST_EMAIL` and `TEST_PASSWORD` as required. Remove the paragraphs about fresh signups and email confirmation. Keep the `BASE_URL` note.

No other files change.
