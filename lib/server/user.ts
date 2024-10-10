import { decrypt, encrypt } from '@/lib/server/encryption'
import { db } from '@/lib/db/drizzle'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

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
