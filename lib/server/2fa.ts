import { db } from '@/lib/db/drizzle'
import { decryptToString, encryptString } from '@/lib/server/encryption'
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
  const userRecoveryCode = decryptToString(
    new Uint8Array(encryptedRecoveryCode)
  )
  if (recoveryCode !== userRecoveryCode) {
    return false
  }

  const newRecoveryCode = generateRandomRecoveryCode()
  const encryptedNewRecoveryCode = encryptString(newRecoveryCode)

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
        recoveryCode: Buffer.from(encryptedNewRecoveryCode),
        totpKey: null,
      })
      .where(
        and(eq(users.id, userId), eq(users.recoveryCode, encryptedRecoveryCode))
      )

    return result
  })

  return updateResult.length > 0

  // Old SQLite queries (for reference):
  // db.execute('UPDATE session SET two_factor_verified = 0 WHERE user_id = ?', [
  //   userId,
  // ])
  // const result = db.execute(
  //   'UPDATE user SET recovery_code = ?, totp_key = NULL WHERE id = ? AND recovery_code = ?',
  //   [encryptedNewRecoveryCode, userId, encryptedRecoveryCode]
  // )
  // return result.changes > 0
}
