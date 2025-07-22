import { createFileRoute } from '@tanstack/react-router';
import Logout from '@/components/Auth/Logout';
import AppLayout from '@/components/Layouts/AppLayout';

export const Route = createFileRoute('/(authenticated)/_authenticated/(auth)/logout')({
	component: () => (
		<AppLayout>
			<Logout />
		</AppLayout>
	),
});
