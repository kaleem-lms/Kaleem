import { Outlet, ScrollRestoration } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AuthProvider } from './AuthContext'

export default function RootComponent() {
    const { i18n } = useTranslation()

    return (
        <div className="flex min-h-screen w-full flex-col">
            <div lang={i18n.language} dir={i18n.dir()}>
                <AuthProvider>
                    <Outlet />
                    <ScrollRestoration />
                </AuthProvider>
            </div>
        </div>
    )
}
