import StudentManagement from '@/components/Dashboard/Teacher/StudentManagement'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/_teacher/students')({
  component: StudentManagement,
})
