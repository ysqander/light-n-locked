import { redirect } from 'next/navigation'
import { Settings } from './settings'
import { getTeamForUser } from '@/lib/db/data-access/teams'
import { getCurrentSession } from '@/lib/auth/diy'

export default async function SettingsPage() {
  const { user } = await getCurrentSession()

  if (!user) {
    redirect('/sign-in')
  }

  const teamData = await getTeamForUser(user.id)

  if (!teamData) {
    throw new Error('Team not found')
  }

  return <Settings teamData={teamData} />
}
