import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="bg-muted rounded-full p-6">
            <ShieldAlert className="h-16 w-16 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight mb-2">{t('401')}</h1>

        <h2 className="text-2xl font-semibold text-muted-foreground mb-6">
          {t('Unauthorized Access')}
        </h2>

        <p className="text-muted-foreground mb-8">
          {t(
            "You don't have permission to access this page. Please log in with the appropriate credentials or contact your administrator."
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link to="/login">{t('Log In')}</Link>
          </Button>

          <Button variant="outline" asChild>
            <Link to="/">{t('Return to Home')}</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 text-center">
        <p className="text-sm text-muted-foreground">
          {t("Don't have an account?")}{' '}
          <Link to="/register" className="text-primary hover:underline">
            {t('Register Now')}
          </Link>
        </p>
      </div>
    </div>
  )
}
