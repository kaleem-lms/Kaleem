import { createFileRoute } from '@tanstack/react-router';
import AppLayout from '@/components/Layouts/AppLayout';
import SessionsPage from '@/components/Sessions';

export const Route = createFileRoute('/(authenticated)/_authenticated/sessions/')({
	component: () => (
		<>
			<AppLayout>
				<SessionsPage />
			</AppLayout>
		</>
	),
});
