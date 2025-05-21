import AppLayout from '@/components/Layouts/AppLayout'
import ProfilePage from '@/components/Profile'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/profile')({
  component: () => {
    return (
      <AppLayout>
        <ProfilePage />
      </AppLayout>
    )
  },
})
