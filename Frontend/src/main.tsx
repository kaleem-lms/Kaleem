import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './global.css'

import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { routeTree } from './routeTree.gen'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from '@/components/theme-provider'

const queryClient = new QueryClient()

// Create a new router instance
const router = createRouter({ routeTree, context: {
    queryClient
} })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

// biome-ignore lint/style/noNonNullAssertion: <explanation>
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                    <ReactQueryDevtools initialIsOpen={false} />
                    <RouterProvider router={router} />
                </ThemeProvider>
            </QueryClientProvider>
        </I18nextProvider>
    </StrictMode>,
)
