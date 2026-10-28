import argon2 from "argon2";

import type { PasswordHasher } from "./password-hasher.interface.js";

export interface Argon2Options {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

// OWASP Password Storage Cheat Sheet, Argon2id minimum: 19 MiB memory, 2 iterations, 1 lane.
export const OWASP_ARGON2_OPTIONS: Argon2Options = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly options: Argon2Options = OWASP_ARGON2_OPTIONS) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, ...this.options });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, this.options);
    } catch {
      return true;
    }
  }
}
