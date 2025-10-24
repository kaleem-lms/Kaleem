import { createFileRoute } from '@tanstack/react-router';
import ReportsPage from '@/components/Reports';

export const Route = createFileRoute('/(authenticated)/_authenticated/reports/')({
	component: ReportsPage,
});
