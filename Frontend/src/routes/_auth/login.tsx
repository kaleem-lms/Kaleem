import Login from '@/components/auth/login'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/login')({
  component: Login,
  beforeLoad: () => {
    console.log('beforeLoad')
  },
})
