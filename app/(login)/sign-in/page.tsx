import { LoginComponent } from '../login'

export default async function SignInPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }
) {
  const searchParams = await props.searchParams;
  const inviteId = searchParams.inviteId as string | undefined

  // We're not redirecting to sign-up anymore
  return <LoginComponent mode="signin" inviteId={inviteId} />
}
