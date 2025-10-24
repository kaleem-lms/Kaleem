import { createFileRoute } from '@tanstack/react-router';
import TeachersPage from '@/components/Teachers';

export const Route = createFileRoute('/(authenticated)/_authenticated/teachers/')({
	component: TeachersPage,
});
