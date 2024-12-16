import Logout from '@/components/auth/logout'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/logout')({
  component: Logout,
})
