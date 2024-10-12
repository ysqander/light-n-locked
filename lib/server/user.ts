import { decrypt, decryptToString, encrypt } from '@/lib/server/encryption'
import { db } from '@/lib/db/drizzle'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/lib/server/password'

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
  // Convert Buffer to Uint8Array
  const uint8Array = new Uint8Array(
    row.totpKey.buffer,
    row.totpKey.byteOffset,
    row.totpKey.length
  )

  return decrypt(uint8Array)
}

export async function updateUserTOTPKey(
  userId: number,
  key: Uint8Array
): Promise<void> {
  const encrypted = encrypt(key)

  // Convert the encrypted Uint8Array to a Buffer
  const encryptedBuffer = Buffer.from(encrypted)

  await db
    .update(users)
    .set({ totpKey: encryptedBuffer })
    .where(eq(users.id, userId))
}

export async function getUserRecoverCode(userId: number): Promise<string> {
  // const row = db.queryOne('SELECT recovery_code FROM user WHERE id = ?', [
  //   userId,
  // ])

  const result = await db
    .select({
      recoveryCode: users.recoveryCode,
    })
    .from(users)
    .where(eq(users.id, userId))

  if (result.length === 0 || result[0].recoveryCode === null) {
    throw new Error('Invalid user ID')
  }
  return decryptToString(new Uint8Array(result[0].recoveryCode))
}

export async function updateUserPassword(
  userId: number,
  password: string
): Promise<void> {
  const passwordHash = await hashPassword(password)
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
}
