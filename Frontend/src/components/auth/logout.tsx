import React from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/api/axios'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

const Logout: React.FC = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()

    const { mutateAsync } = useMutation({
        mutationFn: async () => {
            await api.post('/authentication/logout/')
        },
        onSuccess: () => {
            navigate({ to: '/login' })
        },
        onError: (error) => {
            console.error('Logout failed:', error)
        },
    })

    async function handleLogout() {
        await mutateAsync()
    }

    return (
        <span onClick={handleLogout}>
            {t('logout')}
        </span>
    )
}

export default Logout
