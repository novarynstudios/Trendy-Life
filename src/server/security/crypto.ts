import "server-only"

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { getServerEnvironment } from "@/src/server/env"

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url")
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function encryptSecret(plainText: string) {
  const key = Buffer.from(getServerEnvironment().APP_ENCRYPTION_KEY, "hex")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`
}

export function decryptSecret(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".")
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Unsupported encrypted value")
  const key = Buffer.from(getServerEnvironment().APP_ENCRYPTION_KEY, "hex")
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"))
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8")
}

export function signValue(value: string) {
  const signature = createHmac("sha256", getServerEnvironment().AUTH_SECRET).update(value).digest("base64url")
  return `${value}.${signature}`
}

export function verifySignedValue(signedValue: string) {
  const splitAt = signedValue.lastIndexOf(".")
  if (splitAt < 1) return null
  const value = signedValue.slice(0, splitAt)
  const signature = signedValue.slice(splitAt + 1)
  const expected = createHmac("sha256", getServerEnvironment().AUTH_SECRET).update(value).digest("base64url")
  return safeEqual(signature, expected) ? value : null
}
