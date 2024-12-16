import { createFileRoute } from '@tanstack/react-router'
import StudentRegister from '@/components/auth/student-register'

export const Route = createFileRoute('/_auth/register/student')({
  component: StudentRegister,
})
