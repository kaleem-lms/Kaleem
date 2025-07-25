import { createFileRoute } from '@tanstack/react-router';
import Resources from '@/components/Resources';

export const Route = createFileRoute('/(authenticated)/_authenticated/resources/')({
	component: Resources,
});
