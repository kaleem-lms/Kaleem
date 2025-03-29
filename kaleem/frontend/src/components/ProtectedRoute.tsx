import React from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth()

  return user ? <>{children}</> : <Navigate to="/login" />
}

export default ProtectedRoute
