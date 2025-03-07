import ProfilePage from '@/components/Auth/Profile'
import Header from '@/components/Header'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/profile')({
  component: () => (
    <>
      <Header />
      <ProfilePage />
    </>
  ),
})
