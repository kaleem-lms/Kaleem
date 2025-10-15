import { createFileRoute } from '@tanstack/react-router';
import SettingsPage from '@/components/Settings';

export const Route = createFileRoute('/(authenticated)/_authenticated/settings')({
	component: SettingsPage,
});
