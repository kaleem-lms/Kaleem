import DashboardPage from './Teacher'
import { Sidebar } from '../Sidebar'
import { useAuth } from '../AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  console.log(import.meta.env.MODE); 

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 overflow-auto">
          {user?.role === 'T' && <DashboardPage />}
          {user?.role === 'S' && <p>You are a student.</p>}
          {user?.role === 'P' && <p>You are a parent.</p>}
        </div>
      </div>
    </>
  )
}
