import { argon2, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(argon2);

function derivePassword(password, salt) {
  return deriveKey("argon2id", {
    message: password,
    nonce: salt,
    parallelism: 1,
    memory: 19456,
    passes: 2,
    tagLength: 32
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derivePassword(password, salt);
  return salt.toString("hex") + ":" + key.toString("hex");
}

export async function matchesPassword(password, hash) {
  const [salt, key] = hash.split(":").map(part => Buffer.from(part, "hex"));
  const candidate = await derivePassword(password, salt);
  return timingSafeEqual(candidate, key);
}

export function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

export function matchesKey(key, hash) {
  return timingSafeEqual(Buffer.from(hashKey(key), "hex"), Buffer.from(hash, "hex"));
}

export function generateKey() {
  return randomBytes(32).toString("base64url");
}
