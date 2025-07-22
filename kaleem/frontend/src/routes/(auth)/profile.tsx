import { createFileRoute } from '@tanstack/react-router';
import AppLayout from '@/components/Layouts/AppLayout';
import ProfilePage from '@/components/Profile';

export const Route = createFileRoute('/(auth)/profile')({
	component: () => {
		return (
			<AppLayout>
				<ProfilePage />
			</AppLayout>
		);
	},
});
