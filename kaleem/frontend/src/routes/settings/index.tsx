import Header from '@/components/Header'
import PrivateRoute from '@/components/PrivateRoute'
import Settings from '@/components/Settings'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/')({
  component: () => (
    <>
      <PrivateRoute>
        <Header />
        <Settings />
      </PrivateRoute>
    </>
  ),
})
