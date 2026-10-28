import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK } from "jose";
import { z } from "zod";

type ImportedKey = Awaited<ReturnType<typeof importJWK>>;

export interface SigningKey {
  kid: string;
  privateKey: Exclude<ImportedKey, Uint8Array>;
  publicJwk: Record<string, string>;
}

const privateJwkSchema = z.object({
  kty: z.literal("OKP"),
  crv: z.literal("Ed25519"),
  x: z.string().min(1),
  d: z.string().min(1),
  kid: z.string().min(1),
});

export async function generateSigningKeyJwk(): Promise<string> {
  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const jwk = await exportJWK(privateKey);
  const kid = await calculateJwkThumbprint({ kty: jwk.kty!, crv: jwk.crv!, x: jwk.x! });
  return JSON.stringify({ ...jwk, kid, alg: "EdDSA" });
}

export async function loadSigningKey(serialized: string): Promise<SigningKey> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("AUTH_PRIVATE_KEY must be a JSON Web Key");
  }

  const result = privateJwkSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("AUTH_PRIVATE_KEY must be an Ed25519 private JSON Web Key with a kid");
  }

  const { kty, crv, x, d, kid } = result.data;
  const privateKey = await importJWK({ kty, crv, x, d }, "EdDSA");
  if (privateKey instanceof Uint8Array) {
    throw new Error("AUTH_PRIVATE_KEY could not be imported as a signing key");
  }

  return {
    kid,
    privateKey,
    publicJwk: { kty, crv, x, kid, alg: "EdDSA", use: "sig" },
  };
}
