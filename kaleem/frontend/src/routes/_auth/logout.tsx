import Logout from '@/components/Auth/Logout'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/logout')({
  component: Logout,
})
