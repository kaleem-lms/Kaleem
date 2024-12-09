import { createFileRoute } from '@tanstack/react-router'
import ParentRegister from '@/components/auth/parent-register'

export const Route = createFileRoute('/_auth/register/parent')({
  component: ParentRegister,
})
