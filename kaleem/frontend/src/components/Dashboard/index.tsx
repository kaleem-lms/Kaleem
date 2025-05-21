import DashboardPage from './Teacher'
import { useAuth } from '../AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <>
      {user?.role === 'T' && <DashboardPage />}
      {user?.role === 'S' && <p>You are a student.</p>}
      {user?.role === 'P' && <p>You are a parent.</p>}
    </>
  )
}
