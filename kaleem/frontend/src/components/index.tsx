import { useAuth } from './AuthContext'
import Dashboard from './Dashboard'
import LandingPage from './Landing'
import AppLayout from './Layouts/AppLayout'

export default function Index() {
  const { user } = useAuth()
  if (!user) return <LandingPage />

  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  )
}
