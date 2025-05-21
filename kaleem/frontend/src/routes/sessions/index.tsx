import AppLayout from '@/components/Layouts/AppLayout'
import SessionsPage from '@/components/Sessions'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sessions/')({
  component: () => (
    <>
      <AppLayout>
        <SessionsPage />
      </AppLayout>
    </>
  ),
})
