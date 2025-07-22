import { Outlet, ScrollRestoration } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './AuthContext';

export default function RootComponent() {
	const { i18n } = useTranslation();
	useEffect(() => {
		// Set the direction attribute on the <html> element based on the current language
		document.documentElement.dir = i18n.dir();
	}, [i18n]);

	return (
		<div className="flex min-h-screen w-full flex-col">
			<AuthProvider>
				<Outlet />
				<ScrollRestoration />
				{import.meta.env.MODE === 'development' && <TanStackRouterDevtools />}
			</AuthProvider>
		</div>
	);
}
