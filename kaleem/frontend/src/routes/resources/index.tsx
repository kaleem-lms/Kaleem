import AppLayout from '@/components/Layouts/AppLayout'
import ResourcesPage from '@/components/Resources'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/resources/')({
  component: () => (
    <AppLayout>
      <ResourcesPage />
    </AppLayout>
  ),
})
