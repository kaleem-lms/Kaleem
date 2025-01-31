import LandingPage from '@/components/Landing'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
    component: LandingPage,
})
