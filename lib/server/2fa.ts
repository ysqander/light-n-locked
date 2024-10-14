import { db } from '@/lib/db/drizzle'
import { decrypt, encrypt } from '@/lib/server/encryption'
import { ExpiringTokenBucket } from '@/lib/server/rate-limit'
import { generateRandomRecoveryCode } from '@/lib/utils/codeGen'
import { users, sessions, bytea } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const totpBucket = new ExpiringTokenBucket<number>(5, 60 * 30)
export const recoveryCodeBucket = new ExpiringTokenBucket<number>(3, 60 * 60)

export async function resetUser2FAWithRecoveryCode(
  userId: number,
  recoveryCode: string
): Promise<boolean> {
  const row = await db.transaction(async (tx) => {
    const result = await tx
      .select({ recoveryCode: users.recoveryCode })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
      .limit(1)
    return result[0]
  })

  if (row === null || row.recoveryCode === null) {
    return false
  }
  const encryptedRecoveryCode = row.recoveryCode

  const userRecoveryCode = decrypt(encryptedRecoveryCode)
  if (recoveryCode !== userRecoveryCode) {
    return false
  }

  const newRecoveryCode = generateRandomRecoveryCode()
  const encryptedNewRecoveryCode = encrypt(newRecoveryCode)

  const updateResult = await db.transaction(async (tx) => {
    // Update sessions
    await tx
      .update(sessions)
      .set({ twoFactorVerified: false })
      .where(eq(sessions.userId, userId))

    // Update user
    const result = await tx
      .update(users)
      .set({
        recoveryCode: encryptedNewRecoveryCode,
        totpKey: null,
      })
      .where(
        and(eq(users.id, userId), eq(users.recoveryCode, encryptedRecoveryCode))
      )

    return result
  })

  return updateResult.length > 0
}
