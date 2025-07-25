import { createFileRoute } from '@tanstack/react-router';
import ResourcesPage from '@/components/Resources';

export const Route = createFileRoute('/(authenticated)/_authenticated/resources/')({
	component: ResourcesPage,
});
