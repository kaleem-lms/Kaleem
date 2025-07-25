import SettingsPage from '@/components/Settings';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(authenticated)/_authenticated/settings')({
	component: SettingsPage,
});
