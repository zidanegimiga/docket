# Authentication and authorization

How users sign in, how the API knows who is calling, and how it decides what they may do.
Back to the [project README](../README.md).

## Goals

- Sign in with email and password, or with an OAuth provider (Google today; Microsoft and others
  are configuration, not code changes).
- Anyone can sign up, but a new account has no access until an administrator approves it.
- Administrators define roles and decide who holds which role or permission.
- Every API route is authorized on the server, deny by default.
- The identity code can later move into a separate user service that other services trust.

## Overview

```
Browser ── cookies ──► Next.js ── /api rewrite ──► API
   │                    proxy.ts: no session → /login       ├─ identity module   sign-up, login, OAuth, sessions,
   │                    SessionGate: pending → waiting                           email verification, admin
   │                                                        └─ other modules     authenticate → requirePermission → handler
   └─ access token lapsed? the API client refreshes once and retries

Other services ── Authorization: Bearer <JWT> ──► verify with /.well-known/jwks.json
```

All identity code lives in `apps/api/src/modules/identity/`, with providers (hashing, tokens,
OAuth, email) behind interfaces in `apps/api/src/core/`.

## Identity

| Concept         | Stored as                                                                    |
| --------------- | ---------------------------------------------------------------------------- |
| User            | `users`: email (unique, lower-cased), name, status, password hash (nullable) |
| Linked provider | `user_identities`: provider id and the provider's subject, unique together   |
| Status          | `pending` after sign-up, `active` once approved, `disabled` to block         |
| Verification    | `verification_tokens`: single-use email links, stored as SHA-256 hashes      |

A user can have a password, one or more linked OAuth identities, or both. Every new account gets
the `member` role, so approving someone is a single status change; until then their pending status
withholds the role's permissions.

**Pending users can sign in.** They hold no permissions and the web app shows them a waiting
screen, which can check for approval. Disabled users cannot sign in or refresh.

## Authentication

### Passwords

Argon2id with OWASP's parameters, behind a `PasswordHasher` interface; hashes made with weaker
parameters are upgraded at the next login. Sign-up and login answer the same way, in about the
same time, whether or not the email exists: sign-up always returns 202 and emails the owner
either a welcome or a "someone tried to sign up" notice.

### OAuth and OpenID Connect

Providers implement `OAuthProvider`:

```ts
interface OAuthProvider {
  readonly id: string; // "google", "microsoft", ...
  readonly displayName: string;
  createAuthorizationUrl(request: AuthorizationRequest): Promise<URL>;
  completeAuthorization(callbackUrl: URL, request: AuthorizationRequest): Promise<ExternalIdentity>;
}
```

`OidcProvider` implements it for any OpenID Connect issuer with `openid-client`, using PKCE, state
and nonce. Google and Microsoft Entra are both OpenID Connect, so adding Microsoft is an issuer,
client id and secret in `core/identity/identity.ts`. A provider that is not OpenID Connect, such
as GitHub, implements the same interface. Providers are registered only when configured.

The flow: `GET /auth/oauth/:provider` stores state, nonce, the PKCE verifier and a sanitised return
path in a ten-minute httpOnly cookie and redirects to the provider. The callback (through the web
app's `/api` proxy, so cookies land on its origin) completes the exchange and redirects back to
the web app with a session, or to `/login?error=<CODE>`.

Account rules:

| Situation                                               | Result                            |
| ------------------------------------------------------- | --------------------------------- |
| Identity already linked                                 | Signed in to that account         |
| New email, verified by the provider                     | New pending user                  |
| Email matches an account whose email is verified        | Identity linked to that account   |
| Email matches an account whose email was never verified | Refused: `OAUTH_ACCOUNT_EXISTS`   |
| Provider has not verified the email                     | Refused: `OAUTH_EMAIL_UNVERIFIED` |

Linking needs both sides verified, otherwise whoever registered an address first could take over
the other account.

### Email verification

Password sign-ups receive a 24-hour link to `GET /auth/verify-email?token=...`. Opening it twice
still reports success, so mail scanners that prefetch links cannot lock the user out. Emails go
through an `EmailSender` interface; the current implementation writes them to the log.

### Tokens and sessions

| Cookie           | Contents               | Lifetime   | Path        | Notes                           |
| ---------------- | ---------------------- | ---------- | ----------- | ------------------------------- |
| `docket_access`  | EdDSA (Ed25519) JWT    | 10 minutes | `/`         | httpOnly; also usable as Bearer |
| `docket_refresh` | 256-bit random, opaque | 30 days    | `/api/auth` | httpOnly; only its hash stored  |
| `docket_session` | `1`                    | 30 days    | `/`         | Readable hint; no credential    |

Over HTTPS the names carry the `__Host-` or `__Secure-` prefix. All are `SameSite=Lax`.

- Access tokens carry the user id, status and effective permissions, so any service can authorize
  a request from the token alone. Changes to roles or grants apply at the next refresh.
- The public key is published at `/.well-known/jwks.json` with a key id, so keys can rotate.
- Refresh tokens rotate on every use within a token family. Presenting a rotated token again
  within 30 seconds is treated as a second tab racing (`SESSION_ROTATED`, retry); after that it is
  treated as theft and the whole family is revoked.
- The session hint exists because page requests never carry the refresh cookie. It lets the web
  app's proxy tell a lapsed access token from a visitor who never signed in.
- State-changing requests that carry cookies must also carry an `Origin` (or `Sec-Fetch-Site`)
  matching the web app, which closes cross-site request forgery.

### In the web app

- `src/proxy.ts` redirects page requests without any session cookie to `/login?returnTo=...`. It
  only checks that cookies exist; the API validates them.
- Server components send the access cookie as a bearer token when prefetching. If it has lapsed
  they skip the prefetch and the browser loads the data.
- The browser's API client renews the session on a 401, once for all requests that failed
  together, retries, and sends the user to login when renewal fails.

## Authorization

Permission-based role-based access control, deny by default.

- **Permissions are a fixed catalog in code** (`packages/contracts/src/permissions.ts`), because a
  permission only has meaning where code checks it: `tickets:read`, `tickets:create`,
  `tickets:update:own`, `tickets:update:any`, `users:read`, `users:manage`, `roles:manage`,
  `audit:read`.
- **Roles are data.** `admin` and `member` are system roles created by a migration; administrators
  can define more.
- **Users hold roles and, optionally, direct permission grants.** Their effective permissions are
  the union, in catalog order.
- **Status gates everything.** Pending or disabled users have no effective permissions.
- **Routes check permissions, never role names**, through `requirePermission` after
  `authenticate`. Pending callers get `ACCOUNT_PENDING`, others without the permission
  `PERMISSION_DENIED`.
- **Ownership is a policy step.** `tickets:update:own` allows updating tickets the user created,
  enforced inside the database update; `tickets:update:any` allows all of them.

## Administration

| Endpoint                 | Needs          | Purpose                                                        |
| ------------------------ | -------------- | -------------------------------------------------------------- |
| `GET /admin/users`       | `users:read`   | Filter by status, search, pending first, paginated             |
| `PATCH /admin/users/:id` | `users:manage` | Approve, disable or re-enable; replace roles and direct grants |
| `GET /admin/roles`       | `users:read`   | Roles with permissions and user counts, for assigning them     |
| Role management          | `roles:manage` | Planned                                                        |
| Audit log                | `audit:read`   | Planned                                                        |

Changes to a user are checked and written in one transaction. Administrators cannot disable
themselves or remove their own `users:manage`, and the last active administrator cannot be
disabled or lose the admin role; concurrent changes are serialised so two administrators cannot
demote each other at once. Disabling revokes the user's refresh tokens immediately, and their
next request with a still-valid access token signs them out. Approval emails the user.

The web app's `/admin/users` page lists users, approves pending ones in one click and edits status,
roles and extra permissions. People with `users:read` but not `users:manage` see it read-only.

The first administrator is made from the command line, by someone with database access, after
signing up normally:

```bash
npm run admin:promote -w @docket/api -- --email you@example.com
```

Making the first sign-up an administrator is avoided because it lets whoever registers first take
over.

## Endpoints

| Method and path                      | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `POST /auth/signup`                  | Create a pending account (always 202)                    |
| `POST /auth/login`                   | Password login; sets the session cookies                 |
| `POST /auth/refresh`                 | Rotate the refresh token; returns the current user       |
| `POST /auth/logout`                  | Revoke the session family and clear cookies              |
| `GET /auth/me`                       | The caller, with the status and permissions of the token |
| `GET /auth/providers`                | Configured OAuth providers                               |
| `GET /auth/oauth/:provider`          | Start OAuth sign-in                                      |
| `GET /auth/oauth/:provider/callback` | Finish OAuth sign-in                                     |
| `GET /auth/verify-email`             | Confirm an email address from the emailed link           |
| `GET /.well-known/jwks.json`         | Public signing keys                                      |

## Moving to a user service

Incoming requests depend on two interfaces:

- `TokenVerifier`, today backed by the local key pair, later by the user service's JWKS endpoint.
- `PrincipalResolver`, which turns a presented token into the caller's id, status and permissions.

Moving the identity module into its own service changes those two implementations in the API's
composition root. Ticket code, route guards and tests stay as they are.
