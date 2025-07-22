import { createFileRoute } from '@tanstack/react-router';
import RegistrationPage from '@/components/Auth/Register/RegistrationPage';

export const Route = createFileRoute('/(auth)/register')({
	component: () => <RegistrationPage />,
});
