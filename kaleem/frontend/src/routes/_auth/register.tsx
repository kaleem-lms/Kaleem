import RegistrationPage from '@/components/Auth/Register/RegistrationPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/register')({
  component: () => <RegistrationPage />,
})
