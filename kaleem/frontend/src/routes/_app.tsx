import RootComponent from '@/components/RootComponent'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
  component: () => <RootComponent />,
})
