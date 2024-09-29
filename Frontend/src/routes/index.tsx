import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div className='text-red-900 text-4xl font-bold'>Hello /!</div>,
})
