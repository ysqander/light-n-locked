import { decrypt, encrypt } from '@/lib/server/encryption'
import { db } from '@/lib/db/drizzle'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/lib/server/password'
import { decodeBase64, encodeBase64 } from '@oslojs/encoding'

export async function getUserTOTPKey(
  userId: number
): Promise<Uint8Array | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      totpKey: true,
    },
  })

  if (!row) {
    throw new Error('Invalid user ID')
  }

  if (row.totpKey === null) {
    return null
  }

  const decryptedKey = decrypt(row.totpKey)
  return decodeBase64(decryptedKey)
}

export async function updateUserTOTPKey(
  userId: number,
  key: Uint8Array
): Promise<void> {
  const base64Key = encodeBase64(key)
  const encrypted = encrypt(base64Key)

  await db.update(users).set({ totpKey: encrypted }).where(eq(users.id, userId))
}

export async function getUserRecoverCode(userId: number): Promise<string> {
  const result = await db
    .select({
      recoveryCode: users.recoveryCode,
    })
    .from(users)
    .where(eq(users.id, userId))

  if (result.length === 0 || result[0].recoveryCode === null) {
    throw new Error('Invalid user ID')
  }
  return decrypt(result[0].recoveryCode)
}

export async function updateUserPassword(
  userId: number,
  password: string
): Promise<void> {
  const passwordHash = await hashPassword(password)
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
}
