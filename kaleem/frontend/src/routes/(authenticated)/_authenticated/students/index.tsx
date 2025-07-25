import { createFileRoute } from '@tanstack/react-router';
import StudentsPage from '@/components/Students';

export const Route = createFileRoute('/(authenticated)/_authenticated/students/')({
	component: StudentsPage,
});
