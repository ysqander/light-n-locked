'use server'

import { RefillingTokenBucket } from '@/lib/server/rate-limit'
import { globalPOSTRateLimit } from '@/lib/server/request'
import { getCurrentSession, setSessionAs2FAVerified } from '@/lib/auth/diy'
import { updateUserTOTPKey } from '@/lib/server/user'
import { decodeBase64 } from '@oslojs/encoding'
import { verifyTOTP } from '@oslojs/otp'

const totpUpdateBucket = new RefillingTokenBucket<number>(3, 60 * 10)

interface ActionState {
  success?: string
  error?: string
}

export async function setup2FAAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!globalPOSTRateLimit()) {
    return { error: 'Too many requests' }
  }
  const { session, user } = await getCurrentSession()
  if (session === null) {
    return { error: 'Not authenticated' }
  }
  if (!user.emailVerified) {
    return { error: 'Forbidden' }
  }
  if (user.registered2FA && !session.twoFactorVerified) {
    return { error: 'Forbidden' }
  }
  if (!totpUpdateBucket.check(user.id, 1)) {
    return { error: 'Too many requests' }
  }

  const encodedKey = formData.get('key')
  const code = formData.get('code')
  if (typeof encodedKey !== 'string' || typeof code !== 'string') {
    return { error: 'Invalid or missing fields' }
  }
  if (code === '') {
    return { error: 'Please enter your code' }
  }
  if (encodedKey.length !== 28) {
    return { error: 'Please enter your code' }
  }
  let key: Uint8Array
  try {
    key = decodeBase64(encodedKey)
  } catch {
    return { error: 'Invalid key' }
  }
  if (key.byteLength !== 20) {
    return { error: 'Invalid key' }
  }
  if (!totpUpdateBucket.consume(user.id, 1)) {
    return { error: 'Too many requests' }
  }
  if (!verifyTOTP(key, 30, 6, code)) {
    return { error: 'Invalid code' }
  }
  await updateUserTOTPKey(session.userId, key)
  await setSessionAs2FAVerified(session.id)

  return { success: '2FA setup successful' }
}
