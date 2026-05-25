import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

export class EncryptionService {
  private key: Buffer;

  constructor(masterKey: string) {
    this.key = scryptSync(masterKey, "jobblitz-fixed-salt", 32);
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(SALT_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [saltHex, ivHex, authTagHex, encrypted] = encryptedText.split(":");
    if (!saltHex || !ivHex || !authTagHex || !encrypted) {
      throw new Error("Invalid encrypted text format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

export function hashCredential(value: string): string {
  return createHmac("sha256", process.env.CREDENTIAL_HASH_SECRET || "default-secret")
    .update(value)
    .digest("hex");
}
