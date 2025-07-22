import { createFileRoute } from '@tanstack/react-router';
import ProgramsPage from '@/components/Programs';

export const Route = createFileRoute('/(general)/programs')({
	component: ProgramsPage,
});
