export function isWithinExpirationDate(expiresAt: Date): boolean {
  const now = new Date()
  return now <= new Date(expiresAt)
}
