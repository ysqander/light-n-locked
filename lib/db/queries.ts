import { desc, and, eq, isNull } from 'drizzle-orm'
import { db } from './drizzle'
import { activityLogs, teamMembers, teams, users } from './schema'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth/session'
import { validateRequest } from '@/lib/auth/lucia'

export async function getUser() {
  const sessionCookie = cookies().get('session')
  if (!sessionCookie || !sessionCookie.value) {
    return null
  }

  const sessionData = await verifyToken(sessionCookie.value)
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt))) // Add check for deletedAt
    .limit(1)

  if (user.length === 0) {
    return null
  }

  return user[0]
}

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

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
      teamName: teams.name,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt))) // Add check for deletedAt
    .limit(1)

  return result[0]
}

export async function getActivityLogs() {
  // const user = await getUser();
  const { user } = await validateRequest()
  if (!user) {
    throw new Error('User not authenticated')
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(and(eq(activityLogs.userId, user.id), isNull(users.deletedAt))) // Add check for deletedAt
    .orderBy(desc(activityLogs.timestamp))
    .limit(10)
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
