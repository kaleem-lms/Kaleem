import { Navigate } from '@tanstack/react-router';
import type React from 'react';
import { useAuth } from './AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { user } = useAuth();

	return user ? <>{children}</> : <Navigate to="/login" />;
};

export default ProtectedRoute;
