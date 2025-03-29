import Header from '@/components/Header'
import SessionsPage from '@/components/Sessions'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sessions/')({
  component: () => (
    <>
      <Header />
      <SessionsPage />
    </>
  ),
})
