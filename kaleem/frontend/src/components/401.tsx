import { Link } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function UnauthorizedPage() {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
			<div className="mx-auto max-w-md text-center">
				<div className="mb-6 flex justify-center">
					<div className="rounded-full bg-muted p-6">
						<ShieldAlert className="h-16 w-16 text-primary" />
					</div>
				</div>

				<h1 className="mb-2 font-bold text-4xl tracking-tight">{t('401')}</h1>

				<h2 className="mb-6 font-semibold text-2xl text-muted-foreground">{t('Unauthorized Access')}</h2>

				<p className="mb-8 text-muted-foreground">
					{t(
						"You don't have permission to access this page. Please log in with the appropriate credentials or contact your administrator.",
					)}
				</p>

				<div className="flex flex-col justify-center gap-4 sm:flex-row">
					<Button asChild>
						<Link to="/login">{t('Log In')}</Link>
					</Button>

					<Button variant="outline" asChild>
						<Link to="/">{t('Return to Home')}</Link>
					</Button>
				</div>
			</div>

			<div className="mt-16 text-center">
				<p className="text-muted-foreground text-sm">
					{t("Don't have an account?")}{' '}
					<Link to="/register" className="text-primary hover:underline">
						{t('Register Now')}
					</Link>
				</p>
			</div>
		</div>
	);
}
