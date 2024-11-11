'use server'

import { github } from '@/lib/auth/diy'

import { generateState } from 'arctic'
import { cookies } from 'next/headers'

export async function githubSignIn(
  inviteId?: string,
  mode?: string,
  redirectTo?: string,
  priceId?: string
) {
  const state = generateState()
  const stateWithInfo = `${state}:${inviteId || ''}:${mode || ''}:${
    redirectTo || ''
  }:${priceId || ''}`
  const url = await github.createAuthorizationURL(stateWithInfo, {
    scopes: ['user:email'],
  })
  const cookieStore = await cookies()

  cookieStore.set('github_oauth_state', stateWithInfo, {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  })

  return url.toString()
}
