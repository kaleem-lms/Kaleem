import { createFileRoute } from '@tanstack/react-router'
import TeacherRegister from '@/components/auth/teacher-register'

export const Route = createFileRoute('/_auth/register/teacher')({
  component: TeacherRegister,
})
