import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function getVaultMasterKey(): string {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key) {
    throw new Error("VAULT_MASTER_KEY environment variable is required");
  }
  return key;
}

function deriveKey(userId: string, salt: Buffer): Buffer {
  const masterKey = getVaultMasterKey();
  return pbkdf2Sync(`${userId}:${masterKey}`, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

export function encrypt(plaintext: string, userId: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(userId, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, "base64")]);
  return combined.toString("base64");
}

export function decrypt(ciphertext: string, userId: string): string {
  const combined = Buffer.from(ciphertext, "base64");

  if (combined.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short");
  }

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(userId, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
