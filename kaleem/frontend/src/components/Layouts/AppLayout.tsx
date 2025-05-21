import React from 'react'
import { Sidebar } from '../Sidebar'
import { useAuth } from '../AuthContext'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
