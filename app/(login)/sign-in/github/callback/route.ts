import { createUserAndTeam } from '@/lib/db/data-access/users'
import { github, lucia } from '@/lib/auth/lucia'
import { cookies } from 'next/headers'
import { OAuth2RequestError } from 'arctic'
import { db } from '@/lib/db/drizzle'
import { eq } from 'drizzle-orm'
import { users, type NewUser } from '@/lib/db/schema'
import { createCheckoutSession } from '@/lib/payments/stripe'
import { getUserWithTeamByGithubId } from '@/lib/db/data-access/users'
import {
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
} from '@/lib/auth/diy'
import { getNestedProperty } from '@/lib/utils/parser'
import { SessionFlags } from '@/lib/auth/diy'
import { encrypt } from '@/lib/server/encryption'
import { generateRandomRecoveryCode } from '@/lib/utils/codeGen'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = cookies().get('github_oauth_state')?.value ?? null

  // Clear the github_oauth_state cookie
  cookies().set('github_oauth_state', '', {
    maxAge: 0,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  })

  if (!code || !state || !storedState || state !== storedState) {
    return new Response(null, {
      status: 400,
    })
  }

  const [_, inviteId, mode, redirectTo, priceId] = storedState.split(':')

  try {
    const tokens = await github.validateAuthorizationCode(code)
    const githubUserResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })
    const userResult = await githubUserResponse.json()
    const githubUserId = Number(getNestedProperty(userResult, 'id'))
    const githubUsername = String(getNestedProperty(userResult, 'login'))

    const emailListResponse = await fetch(
      'https://api.github.com/user/emails',
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    )
    const emailListResult: unknown = await emailListResponse.json()

    if (!Array.isArray(emailListResult) || emailListResult.length < 1) {
      return new Response('Please restart the process.', {
        status: 400,
      })
    }

    let email: string | null = null
    for (const emailRecord of emailListResult) {
      const primaryEmail = getNestedProperty(emailRecord, 'primary')
      const verifiedEmail = getNestedProperty(emailRecord, 'verified')
      if (primaryEmail && verifiedEmail) {
        email = String(getNestedProperty(emailRecord, 'email'))
        if (email !== null) break
      }
    }

    if (email === null) {
      return new Response('Please verify your GitHub email address.', {
        status: 400,
      })
    }

    const userWithTeam = await getUserWithTeamByGithubId(githubUserId)

    if (userWithTeam.length === 0) {
      const recoveryCode = generateRandomRecoveryCode()
      const encryptedRecoveryCode = encrypt(recoveryCode)

      // Create new user logging in with GitHub
      const newUser: NewUser = {
        githubId: githubUserId,
        githubUsername: githubUsername,
        email: email,
        role: 'owner', // Default role, will be overridden if there's an invitation,
        recoveryCode: encryptedRecoveryCode,
      }

      try {
        const { user: createdUser, team: createdTeam } =
          await createUserAndTeam(newUser, inviteId)

        const sessionFlags: SessionFlags = {
          twoFactorVerified: false,
          oAuth2Verified: true,
        }
        const sessionToken = generateSessionToken()
        const session = await createSession(
          sessionToken,
          createdUser.id,
          sessionFlags
        )
        setSessionTokenCookie(sessionToken, session.expiresAt)

        // Handle checkout redirection for new users
        if (redirectTo === 'checkout' && priceId) {
          const checkoutUrl = await createCheckoutSession({
            team: createdTeam,
            priceId,
          })
          return new Response(null, {
            status: 302,
            headers: {
              Location: checkoutUrl,
            },
          })
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: '/dashboard',
          },
        })
      } catch (error) {
        console.error('Failed to create user and team:', error)
        return new Response(null, {
          status: 500,
        })
      }
    } else {
      const { user: foundUser, team: foundTeam } = userWithTeam[0]

      if (mode === 'signup') {
        return new Response(null, {
          status: 302,
          headers: {
            Location: '/sign-in?error=github_account_exists',
          },
        })
      }

      const sessionFlags: SessionFlags = {
        twoFactorVerified: false,
        oAuth2Verified: true,
      }

      const sessionToken = generateSessionToken()
      const session = await createSession(
        sessionToken,
        foundUser.id,
        sessionFlags
      )
      setSessionTokenCookie(sessionToken, session.expiresAt)

      // Handle checkout for existing users
      if (redirectTo === 'checkout' && priceId) {
        const url = await createCheckoutSession({
          team: foundTeam,
          priceId,
        })

        return new Response(null, {
          status: 302,
          headers: {
            Location: url,
          },
        })
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: '/dashboard',
        },
      })
    }
  } catch (e) {
    // the specific error message depends on the provider
    if (e instanceof OAuth2RequestError) {
      // invalid code
      return new Response(null, {
        status: 400,
      })
    }
    return new Response(null, {
      status: 500,
    })
  }
}

interface GitHubUser {
  id: string
  login: string
  email: string | null | undefined
}
