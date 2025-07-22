import { createFileRoute } from '@tanstack/react-router';
import CurriculumPage from '@/components/Curriculum';

export const Route = createFileRoute('/(general)/curriculum')({
	component: CurriculumPage,
});
