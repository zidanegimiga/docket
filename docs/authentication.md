# Authentication and authorization

How users sign in, how the API knows who is calling, and how it decides what they may do.
Back to the [project README](../README.md).

## Goals

- Sign in with email and password, or with an OAuth provider (Google first, Microsoft and others
  later without touching business code).
- Anyone can sign up, but a new account has no access until an administrator approves it.
- Administrators define roles and decide who holds which role or permission.
- Every API route is authorized on the server, deny by default.
- The identity code can later move into a separate user service that other services trust.

## Overview

```
Browser ── cookies ──► Next.js ── /api rewrite ──► API
                                                   ├─ auth module     sign up, log in, OAuth, refresh, log out
                                                   ├─ users module    admin: approve, assign roles and permissions
                                                   ├─ roles module    admin: define roles
                                                   └─ every other route: authenticate → authorize → handler

Other services ── Authorization: Bearer <JWT> ──► verify with /.well-known/jwks.json
```

## Identity

| Concept         | Stored as                                                                         |
| --------------- | --------------------------------------------------------------------------------- |
| User            | `users`: email (unique, case-insensitive), name, status, password hash (nullable) |
| Linked provider | `user_identities`: provider id and the provider's subject, unique together        |
| Status          | `pending` after sign-up, `active` once approved, `disabled` to block              |

A user can have a password, one or more linked OAuth identities, or both. OAuth sign-in only links
to an existing account when both sides have a verified email; otherwise it is refused, which
prevents takeover through an unverified address.

## Authentication

### Passwords

Hashed with Argon2id (OWASP's first recommendation) behind a `PasswordHasher` interface. Login
answers with the same error and similar timing whether the email exists or not.

### OAuth and OpenID Connect

Providers implement `OAuthProvider`:

```ts
interface OAuthProvider {
  readonly id: string; // "google", "microsoft", ...
  createAuthorizationUrl(request: { state: string; codeVerifier: string; nonce: string }): URL;
  exchangeCode(callback: CallbackParams, request: PendingAuthorization): Promise<ExternalIdentity>;
}
```

`OidcProvider` implements it for any OpenID Connect issuer using `openid-client`, with PKCE, state
and nonce. Google and Microsoft Entra are both OpenID Connect, so adding Microsoft is configuration
(issuer, client id, secret). A provider that is not OpenID Connect, such as GitHub, implements the
same interface. Providers are registered in the composition root only when their credentials are
configured.

### Tokens and sessions

| Token         | Format                          | Lifetime   | Stored                                                   |
| ------------- | ------------------------------- | ---------- | -------------------------------------------------------- |
| Access token  | JWT signed with EdDSA (Ed25519) | 10 minutes | `httpOnly` cookie, or `Authorization: Bearer`            |
| Refresh token | 256-bit random, opaque          | 30 days    | `httpOnly` cookie; only its SHA-256 hash in the database |

- Access tokens carry the user id, status and effective permissions, so any service can authorize
  a request from the token alone, without calling back.
- Public keys are published at `/.well-known/jwks.json` with a key id, so keys can be rotated.
- Refresh tokens rotate on every use. Reusing an already rotated token revokes the whole token
  family, which ends a stolen session the moment either party uses it again.
- Cookies are `Secure` in production and `SameSite=Lax`. State-changing requests must also carry
  an `Origin` header matching the web app, which closes the remaining cross-site request paths.

### Email

Verification emails go through an `EmailSender` interface. The current implementation logs the
link instead of sending it, so a real provider is one new class.

## Authorization

Permission-based role-based access control, deny by default.

- **Permissions are a fixed catalog in code** (`packages/contracts`), because a permission only
  has meaning where code checks it. Examples: `tickets:read`, `tickets:create`,
  `tickets:update:own`, `tickets:update:any`, `users:read`, `users:manage`, `roles:manage`.
- **Roles are data.** Administrators create roles as named sets of permissions.
- **Users hold roles and, optionally, direct permission grants.** Their effective permissions are
  the union.
- **Routes check permissions, never role names**, so a new role never needs a code change.
- **Ownership** is a separate policy step: `tickets:update:own` allows updating tickets the user
  created, `tickets:update:any` allows all of them.
- **Status gates everything.** A `pending` or `disabled` user has no effective permissions,
  whatever their roles say.

Changes to roles or grants reach the user within one access-token lifetime, when the token is
refreshed with fresh permissions. Disabling a user revokes their refresh tokens immediately.

Administrative changes (approvals, role and permission changes, disabling) are written to an
audit log.

## Bootstrapping

The first administrator is created with a command-line script against the database. Making the
first sign-up an administrator is avoided because it lets whoever registers first take over.

## Moving to a user service

The API depends on two interfaces for incoming requests:

- `TokenVerifier`, today backed by the local key pair, later by the user service's JWKS endpoint.
- `PrincipalResolver`, which turns a verified token into the caller's id, status and permissions.

Moving the auth, users and roles modules into their own service changes those two implementations
in the API's composition root. Ticket code, route guards and tests stay as they are.
