import { LoginComponent } from '../login'

export default function SignInPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const inviteId = searchParams.inviteId as string | undefined

  // We're not redirecting to sign-up anymore
  return <LoginComponent mode="signin" inviteId={inviteId} />
}
