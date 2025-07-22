import { createFileRoute } from '@tanstack/react-router';
import AboutPage from '@/components/About';

export const Route = createFileRoute('/(general)/about')({
	component: AboutPage,
});
