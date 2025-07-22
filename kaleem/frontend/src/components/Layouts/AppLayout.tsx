import type React from 'react';
import { useAuth } from '../AuthContext';
import { Sidebar } from '../Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { user } = useAuth();
	if (!user) return null;

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	);
}
