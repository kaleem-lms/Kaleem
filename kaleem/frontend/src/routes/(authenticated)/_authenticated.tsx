import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import AppLayout from '@/components/Layouts/AppLayout';

export const Route = createFileRoute('/(authenticated)/_authenticated')({
	component: RouteComponent,
});

export function RouteComponent() {
	const { user } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		console.log(`user: ${user}`);
		if (!user) {
			navigate({ to: '/login' });
		}
	}, [user, navigate]);

	return (
		<AppLayout>
			<Outlet />
		</AppLayout>
	);
}
