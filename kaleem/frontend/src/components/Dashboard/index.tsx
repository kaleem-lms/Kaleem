import Header from '../Header'
import { useAuth } from '@/hooks/useAuth'
import TeacherDashboard from './Teacher'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <>
      <Header />
      {user?.role === 'T' && <TeacherDashboard />}
      {user?.role === 'S' && <p>You are a student.</p>}
      {user?.role === 'P' && <p>You are a parent.</p>}
    </>
  )
}
