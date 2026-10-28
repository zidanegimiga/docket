import { describe, expect, it } from "vitest";

import {
  Argon2PasswordHasher,
  OWASP_ARGON2_OPTIONS,
} from "../../src/core/identity/argon2.password-hasher.js";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();
  const password = "correct horse battery staple";

  it("produces an Argon2id hash with the OWASP parameters", async () => {
    const hash = await hasher.hash(password);

    const [, algorithm, version, parameters] = hash.split("$");
    expect({ algorithm, version }).toEqual({ algorithm: "argon2id", version: "v=19" });
    expect(Object.fromEntries(parameters!.split(",").map((pair) => pair.split("=")))).toEqual({
      m: "19456",
      t: "2",
      p: "1",
    });
    expect(hash).not.toContain(password);
  });

  it("salts every hash so equal passwords never share a hash", async () => {
    const [first, second] = await Promise.all([hasher.hash(password), hasher.hash(password)]);

    expect(first).not.toBe(second);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hasher.hash(password);

    await expect(hasher.verify(hash, password)).resolves.toBe(true);
    await expect(hasher.verify(hash, "correct horse battery stapl")).resolves.toBe(false);
    await expect(hasher.verify(hash, password.toUpperCase())).resolves.toBe(false);
  });

  it("treats a malformed stored hash as a failed verification", async () => {
    await expect(hasher.verify("not-a-hash", password)).resolves.toBe(false);
  });

  it("flags hashes made with weaker parameters for rehashing", async () => {
    const weaker = new Argon2PasswordHasher({ ...OWASP_ARGON2_OPTIONS, memoryCost: 8_192 });
    const weakHash = await weaker.hash(password);

    expect(hasher.needsRehash(weakHash)).toBe(true);
    expect(hasher.needsRehash(await hasher.hash(password))).toBe(false);
    expect(hasher.needsRehash("not-a-hash")).toBe(true);
  });
});
