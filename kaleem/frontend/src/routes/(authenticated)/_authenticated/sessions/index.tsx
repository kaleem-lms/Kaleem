import { createFileRoute } from '@tanstack/react-router';
import SessionsPage from '@/components/Sessions';

export const Route = createFileRoute('/(authenticated)/_authenticated/sessions/')({
	component: SessionsPage,
});
