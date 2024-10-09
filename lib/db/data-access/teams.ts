import { desc, and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db/drizzle'
import { activityLogs, teamMembers, teams, users } from '@/lib/db/schema'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth/session'

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1)

  return result.length > 0 ? result[0] : null
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null
    stripeProductId: string | null
    planName: string | null
    subscriptionStatus: string
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId))
}

export async function getTeamForUser(userId: number) {
  const result = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)), // Add check for deletedAt
    with: {
      teamMembers: {
        with: {
          team: {
            with: {
              teamMembers: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  return result?.teamMembers[0]?.team || null
}
