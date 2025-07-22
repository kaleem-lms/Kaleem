import { createFileRoute } from '@tanstack/react-router';
import TermsPage from '@/components/Terms';

export const Route = createFileRoute('/(general)/terms')({
	component: TermsPage,
});
