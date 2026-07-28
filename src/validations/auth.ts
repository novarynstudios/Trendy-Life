import { z } from "zod"

export const staffLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254).transform((value) => value.toLocaleLowerCase()),
  password: z.string().min(1, "Enter your password.").max(128),
})

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code."),
})
