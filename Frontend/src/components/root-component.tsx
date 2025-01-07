import { Outlet, ScrollRestoration } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import Header from './header'

export default function RootComponent() {
    const { i18n } = useTranslation()

    // const changeLanguage = (lng: string) => {
    //     i18n.changeLanguage(lng)
    // }

    return (
        <div className="flex min-h-screen w-full flex-col">
            <div lang={i18n.language} dir={i18n.dir()}>
                <Header/>
                <Outlet />
                <ScrollRestoration />
            </div>
        </div>
    )
}
