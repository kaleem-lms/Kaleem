import RootComponent from '@/components/root-component'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
    component: () => (
        <>
            <RootComponent />
            <div>Hello /_layout!</div>
        </>
    ),
})
