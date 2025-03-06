import { useContext } from 'react'
import { AuthContext } from '@/components/AuthContext'
import { loginUser, logoutUser } from '@/api/axios'
import { LoginData } from '@/types'

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  const { user, setUser } = context

  const login = async (loginData: LoginData) => {
    const loggedInUser = await loginUser(loginData)
    if (loggedInUser) {
      setUser(loggedInUser)
    }
    return loggedInUser
  }

  const logout = async () => {
    await logoutUser()
    setUser(null)
  }

  console.log(user)
  return { user:user, login, logout }
}
