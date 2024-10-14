import { decodeBase64, encodeBase64 } from '@oslojs/encoding'
import { createCipheriv, createDecipheriv } from 'crypto'
import { DynamicBuffer } from '@oslojs/binary'

const key = decodeBase64(process.env.ENCRYPTION_KEY ?? '')

export function encrypt(data: string): string {
  const iv = new Uint8Array(16)
  crypto.getRandomValues(iv)
  const cipher = createCipheriv('aes-128-gcm', key, iv)
  const encrypted = new DynamicBuffer(0)
  encrypted.write(iv)
  encrypted.write(new Uint8Array(cipher.update(new TextEncoder().encode(data))))
  encrypted.write(new Uint8Array(cipher.final()))
  encrypted.write(new Uint8Array(cipher.getAuthTag()))
  return encodeBase64(encrypted.bytes())
}

export function decrypt(encryptedBase64: string): string {
  const encrypted = decodeBase64(encryptedBase64)
  if (encrypted.byteLength < 33) {
    throw new Error('Invalid data')
  }
  const decipher = createDecipheriv('aes-128-gcm', key, encrypted.slice(0, 16))
  decipher.setAuthTag(encrypted.slice(encrypted.byteLength - 16))
  const decrypted = new DynamicBuffer(0)
  decrypted.write(
    new Uint8Array(
      decipher.update(encrypted.slice(16, encrypted.byteLength - 16))
    )
  )
  decrypted.write(new Uint8Array(decipher.final()))
  return new TextDecoder().decode(decrypted.bytes())
}
