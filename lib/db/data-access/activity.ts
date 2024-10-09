import {
  ActivityType,
  activityLogs,
  type NewActivityLog,
  users,
} from '@/lib/db/schema'
import { db } from '@/lib/db/drizzle'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { getCurrentSession } from '@/lib/auth/diy'

export async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || '',
  }
  await db.insert(activityLogs).values(newActivity)
}

export async function getActivityLogs() {
  const { user } = await getCurrentSession()
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

export async function getActivityLogsForActiveUsers(teamId: number) {
  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userId: activityLogs.userId,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.userId, users.id))
    .where(and(eq(activityLogs.teamId, teamId), isNull(users.deletedAt)))
    .orderBy(desc(activityLogs.timestamp))
}
