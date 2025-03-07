import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="bg-muted rounded-full p-6">
            <FileQuestion className="h-16 w-16 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight mb-2">{t('404')}</h1>

        <h2 className="text-2xl font-semibold text-muted-foreground mb-6">
          {t('Page not found')}
        </h2>

        <p className="text-muted-foreground mb-8">
          {t(
            "We couldn't find the page you're looking for. The page may have been moved, deleted, or never existed."
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link to="/">{t('Go to Home')}</Link>
          </Button>

          <Button variant="outline" asChild>
            <Link to="/programs">{t('Explore Programs')}</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 text-center">
        <p className="text-sm text-muted-foreground">
          {t('Need assistance?')}{' '}
          <Link to="/#contact" className="text-primary hover:underline">
            {t('Contact Support')}
          </Link>
        </p>
      </div>
    </div>
  )
}
