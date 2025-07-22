import { createFileRoute } from '@tanstack/react-router';
import AppLayout from '@/components/Layouts/AppLayout';
import StudentsPage from '@/components/Students';

export const Route = createFileRoute('/(authenticated)/_authenticated/students/')({
	component: () => (
		<AppLayout>
			<StudentsPage />
		</AppLayout>
	),
});
