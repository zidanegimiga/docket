import { generateSigningKeyJwk } from "../src/core/identity/signing-key.js";

const jwk = await generateSigningKeyJwk();

console.log("Add this to apps/api/.env, or as a secret environment variable on the host:\n");
console.log(`AUTH_PRIVATE_KEY='${jwk}'`);
