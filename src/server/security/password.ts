import argon2 from "argon2"
import { z } from "zod"

export const passwordPolicySchema = z.string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Password must not exceed 128 characters.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.")

export function validatePassword(password: string, identityValues: string[] = []) {
  const result = passwordPolicySchema.safeParse(password)
  if (!result.success) return { valid: false as const, errors: result.error.issues.map((issue) => issue.message) }
  const normalized = password.toLocaleLowerCase()
  if (identityValues.some((value) => value.length > 2 && normalized.includes(value.toLocaleLowerCase()))) {
    return { valid: false as const, errors: ["Password must not contain your name or email address."] }
  }
  return { valid: true as const, errors: [] }
}

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  })
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}
