import { db } from '@/lib/db/drizzle'
import { users } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'

export function verifyEmailInput(email: string): boolean {
  return /^.+@.+\..+$/.test(email) && email.length < 256
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  try {
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.email, email))

    if (result.length === 0) {
      throw new Error('Unexpected empty result from database query')
    }

    return result[0].count === 0
  } catch (error) {
    console.error('Error checking email availability:', error)
    throw new Error('Failed to check email availability')
  }
}
