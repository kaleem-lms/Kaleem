import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { useNavigate } from '@tanstack/react-router'
import { User, AuthContextType } from '../types'
import { getCurrentUser } from '@/api/axios'

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchUser() {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        navigate({ to: '/login' })
      }
      setUser(currentUser)
      setLoading(false)
    }
    fetchUser()
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    navigate({ to: '/dashboard' })
  }

  const logout = () => {
    setUser(null)
    navigate({ to: '/login' })
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
