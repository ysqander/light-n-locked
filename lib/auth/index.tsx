'use client'

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from 'react'
import { use } from 'react'
import { LimitedUser } from '@/lib/db/schema'
import { SessionValidationResultLimitedUser } from '@/lib/auth/diy'

type UserContextType = {
  user: LimitedUser | null
  setUser: (user: LimitedUser | null) => void
}

const UserContext = createContext<UserContextType | null>(null)

export function useUser(): UserContextType {
  let context = useContext(UserContext)
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

export function UserProvider({
  children,
  userPromise,
}: {
  children: ReactNode
  userPromise: Promise<SessionValidationResultLimitedUser>
}) {
  let { user: initialUser } = use(userPromise)
  let [user, setUser] = useState<LimitedUser | null>(initialUser)

  useEffect(() => {
    setUser(initialUser)
  }, [initialUser])

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}
