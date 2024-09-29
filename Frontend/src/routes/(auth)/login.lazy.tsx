import Login from '@/components/auth/Login'
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/(auth)/login')({
  component: Login,
  
})
