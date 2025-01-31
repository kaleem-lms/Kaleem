import { createFileRoute } from '@tanstack/react-router'
import WeeklySchedule from '@/components/Settings/WeeklySchedule'
import ProtectedRoute from '@/components/ProtectedRoute'

export const Route = createFileRoute('/settings/weekly_schedule')({
  component: () => (
    <ProtectedRoute>
      <WeeklySchedule />
    </ProtectedRoute>
  ),
})
