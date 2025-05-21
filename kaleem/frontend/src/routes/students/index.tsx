import AppLayout from '@/components/Layouts/AppLayout'
import StudentsPage from '@/components/Students'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/students/')({
  component: () => (
    <AppLayout>
      <StudentsPage />
    </AppLayout>
  ),
})

