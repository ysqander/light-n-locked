import { redirect } from 'next/navigation'
import { Settings } from './settings'
import { getTeamForUser, getUser } from '@/lib/db/queries'
import { validateRequest } from '@/lib/auth/lucia'

export default async function SettingsPage() {
  //const user = await getUser();
  const { user } = await validateRequest()

  if (!user) {
    redirect('/login')
  }

  const teamData = await getTeamForUser(user.id)

  if (!teamData) {
    throw new Error('Team not found')
  }

  return <Settings teamData={teamData} />
}
