import Index from '@/components'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
    component: Index,
})
