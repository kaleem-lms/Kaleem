import { useAuth } from './AuthContext'
import Dashboard from './Dashboard'
import LandingPage from './Landing'

export default function Index() {
  const { user } = useAuth()
  return user ? <Dashboard /> : <LandingPage />
}
