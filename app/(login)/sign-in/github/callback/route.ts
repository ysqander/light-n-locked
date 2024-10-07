import { createUserAndTeam } from '@/lib/db/data-access/users'
import { github, lucia } from '@/lib/auth/lucia'
import { cookies } from 'next/headers'
import { OAuth2RequestError } from 'arctic'
import { db } from '@/lib/db/drizzle'
import { eq } from 'drizzle-orm'
import { users, type NewUser } from '@/lib/db/schema'
import { createCheckoutSession } from '@/lib/payments/stripe'
import { getUserWithTeamByGithubId } from '@/lib/db/data-access/users'

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
    const githubUser: GitHubUser = await githubUserResponse.json()

    const existingUser = await db.query.users.findFirst({
      where: eq(users.githubId, githubUser.id),
    })

    const userWithTeam = await getUserWithTeamByGithubId(githubUser.id)

    if (userWithTeam.length === 0) {
      // Create new user logging in with GitHub
      const newUser: NewUser = {
        githubId: githubUser.id,
        githubUsername: githubUser.login,
        email: githubUser.email, // This might be null or undefined
        role: 'owner', // Default role, will be overridden if there's an invitation
      }

      try {
        const { user: createdUser, team: createdTeam } =
          await createUserAndTeam(newUser, inviteId)

        const session = await lucia.createSession(createdUser.id, {})
        const sessionCookie = lucia.createSessionCookie(session.id)
        cookies().set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        )

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

      const session = await lucia.createSession(foundUser.id, {})
      const sessionCookie = lucia.createSessionCookie(session.id)
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      )

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
