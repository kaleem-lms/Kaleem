import React, { createContext, useState, useEffect } from 'react'
import { User } from '@/types'
import { getCurrentUser } from '@/api/axios'

interface AuthContextType {
  user: User | null
  setUser: React.Dispatch<React.SetStateAction<User | null>>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        console.log("Current user:", currentUser);
        setUser(currentUser)
      } catch (error) {
        console.error("Failed to fetch user:", error)
        setUser(null)
      }
    }
    loadUser()
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
