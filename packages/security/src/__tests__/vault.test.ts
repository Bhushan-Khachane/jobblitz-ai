import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../vault";

describe("vault", () => {
  it("encrypts and decrypts roundtrip", () => {
    process.env.VAULT_MASTER_KEY = "test-master-key-32-bytes-long!!!";
    const plaintext = "my-secret-password";
    const userId = "user-123";

    const ciphertext = encrypt(plaintext, userId);
    const decrypted = decrypt(ciphertext, userId);

    expect(decrypted).toBe(plaintext);
  });

  it("fails decryption with wrong userId", () => {
    process.env.VAULT_MASTER_KEY = "test-master-key-32-bytes-long!!!";
    const plaintext = "my-secret-password";
    const ciphertext = encrypt(plaintext, "user-a");

    expect(() => decrypt(ciphertext, "user-b")).toThrow();
  });
});
