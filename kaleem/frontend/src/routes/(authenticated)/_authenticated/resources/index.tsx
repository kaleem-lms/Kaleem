import { createFileRoute } from '@tanstack/react-router';
import AppLayout from '@/components/Layouts/AppLayout';
import ResourcesPage from '@/components/Resources';

export const Route = createFileRoute('/(authenticated)/_authenticated/resources/')({
	component: () => (
		<AppLayout>
			<ResourcesPage />
		</AppLayout>
	),
});
