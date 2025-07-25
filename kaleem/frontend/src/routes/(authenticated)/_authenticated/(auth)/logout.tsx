import { createFileRoute } from '@tanstack/react-router';
import Logout from '@/components/Auth/Logout';

export const Route = createFileRoute('/(authenticated)/_authenticated/(auth)/logout')({
	component: Logout,
});
