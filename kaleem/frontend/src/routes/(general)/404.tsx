import { createFileRoute } from '@tanstack/react-router';
import NotFoundPage from '@/components/404';

export const Route = createFileRoute('/(general)/404')({
	component: NotFoundPage,
});
