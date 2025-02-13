import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

const Header = () => {
  const { i18n, t } = useTranslation()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
  }

  return (
    <header className="bg-background border-b h-fit relative">
      <div className="absolute end-4 top-1/2 translate-y-1/2">
        <Select value={i18n.language} onValueChange={changeLanguage}>
          <SelectTrigger id="language-select">
            <SelectValue placeholder="Select a language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-fit">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img
                src="/kaleem/cover.svg"
                className="w-[30vw] h-[15vh]"
                alt=""
              />
            </Link>
            <nav className="hidden md:ml-6 md:flex md:space-x-4">
              <Link
                to="/about"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                {t('About Us')}
              </Link>
              <Link
                to="/programs"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                {t('Programs')}
              </Link>
              <Link
                to="/terms"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                {t('Terms & Conditions')}
              </Link>
              <Link
                to="/pricing"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                {t('Pricing')}
              </Link>
              <Link
                to="/login"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                {t('Login')}
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
