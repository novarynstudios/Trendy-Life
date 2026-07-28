import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function encodeBase32(input: Buffer) {
  let bits = ""
  for (const byte of input) bits += byte.toString(2).padStart(8, "0")
  let output = ""
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)]
  }
  return output
}

function decodeBase32(value: string) {
  let bits = ""
  for (const character of value.toUpperCase().replace(/=|\s/g, "")) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error("Invalid base32 secret")
    bits += index.toString(2).padStart(5, "0")
  }
  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  return Buffer.from(bytes)
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20))
}

export function totpUri(secret: string, email: string) {
  const issuer = encodeURIComponent("Trendy Life Admin")
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

function generateTotpAt(secret: string, timestamp: number) {
  const counter = Math.floor(timestamp / 30)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0")
  return code
}

export function verifyTotp(secret: string, token: string, now = Date.now()) {
  const normalized = token.replace(/\s/g, "")
  if (!/^\d{6}$/.test(normalized)) return false
  for (const drift of [-1, 0, 1]) {
    const candidate = generateTotpAt(secret, Math.floor(now / 1000) + drift * 30)
    const left = Buffer.from(candidate)
    const right = Buffer.from(normalized)
    if (left.length === right.length && timingSafeEqual(left, right)) return true
  }
  return false
}
