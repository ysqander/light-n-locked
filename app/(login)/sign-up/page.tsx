import { LoginComponent } from '../login'

export default async function SignUpPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }
) {
  const searchParams = await props.searchParams;
  const inviteId = searchParams.inviteId as string | undefined

  // We're not redirecting to sign-up anymore
  return <LoginComponent mode="signup" inviteId={inviteId} />
}
