import { Link } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
			<div className="mx-auto max-w-md text-center">
				<div className="mb-6 flex justify-center">
					<div className="rounded-full bg-muted p-6">
						<FileQuestion className="h-16 w-16 text-primary" />
					</div>
				</div>

				<h1 className="mb-2 font-bold text-4xl tracking-tight">{t('404')}</h1>

				<h2 className="mb-6 font-semibold text-2xl text-muted-foreground">{t('Page not found')}</h2>

				<p className="mb-8 text-muted-foreground">
					{t("We couldn't find the page you're looking for. The page may have been moved, deleted, or never existed.")}
				</p>

				<div className="flex flex-col justify-center gap-4 sm:flex-row">
					<Button asChild>
						<Link to="/">{t('Go to Home')}</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link to="/programs">{t('Explore Programs')}</Link>
					</Button>
				</div>
			</div>

			<div className="mt-16 text-center">
				<p className="text-muted-foreground text-sm">
					{t('Need assistance?')}{' '}
					<Link to="/#contact" className="text-primary hover:underline">
						{t('Contact Support')}
					</Link>
				</p>
			</div>
		</div>
	);
}
