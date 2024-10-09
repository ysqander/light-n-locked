import { z } from 'zod'
import { TeamDataWithMembers } from '@/lib/db/schema' // removed User object from db and replaced with the Lucia one
import { getTeamForUser } from '@/lib/db/data-access/teams'
import { redirect } from 'next/navigation'
import { User } from '@/lib/db/schema'
import { getCurrentSession } from '@/lib/auth/diy'

export type ActionState = {
  error?: string
  success?: string
  [key: string]: any // This allows for additional properties
}

type ValidatedActionFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData
) => Promise<T>

export function validatedAction<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData): Promise<T> => {
    const result = schema.safeParse(Object.fromEntries(formData))
    if (!result.success) {
      return { error: result.error.errors[0].message } as T
    }

    return action(result.data, formData)
  }
}

type ValidatedActionWithUserFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData,
  user: User
) => Promise<T>

export function validatedActionWithUser<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionWithUserFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData): Promise<T> => {
    const { user } = await getCurrentSession()
    if (!user) {
      throw new Error('User is not authenticated')
    }

    const result = schema.safeParse(Object.fromEntries(formData))
    if (!result.success) {
      return { error: result.error.errors[0].message } as T
    }

    return action(result.data, formData, user)
  }
}

type ActionWithTeamFunction<T> = (
  formData: FormData,
  team: TeamDataWithMembers
) => Promise<T>

export function withTeam<T>(action: ActionWithTeamFunction<T>) {
  return async (formData: FormData): Promise<T> => {
    const { user } = await getCurrentSession()
    if (!user) {
      redirect('/sign-in')
    }

    const team = await getTeamForUser(user.id)
    if (!team) {
      throw new Error('Team not found')
    }

    return action(formData, team)
  }
}
