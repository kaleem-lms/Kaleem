import Login from '@/components/Auth/Login'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/login')({
    component: Login,
    beforeLoad: () => {
        console.log('beforeLoad')
    },
})
