import './global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import { routeTree } from './routeTree.gen'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from './components/AuthContext'
import { Toaster } from "@/components/ui/toaster"

// Create a new router instance
const router = createRouter({ routeTree })

// biome-ignore lint/style/noNonNullAssertion: <explanation>
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster/>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  </StrictMode>,
)
