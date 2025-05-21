import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { useState, useRef, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Menu, X } from "lucide-react"

const Header = () => {
  const { i18n, t } = useTranslation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuHeight, setMenuHeight] = useState(0)

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    document.documentElement.dir = lng === "ar" ? "rtl" : "ltr"
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  // Calculate and update menu height when it opens/closes or on resize
  useEffect(() => {
    if (menuRef.current) {
      if (isMenuOpen) {
        setMenuHeight(menuRef.current.scrollHeight)
      } else {
        setMenuHeight(0)
      }
    }
  }, [isMenuOpen])

  // Update height on window resize if menu is open
  useEffect(() => {
    const handleResize = () => {
      if (isMenuOpen && menuRef.current) {
        setMenuHeight(menuRef.current.scrollHeight)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isMenuOpen])

  return (
    <header className="bg-background border-b relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img src="/kaleem/cover.svg" className="w-[120px] h-auto sm:w-[150px] md:w-[180px]" alt="Kaleem Logo" />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:items-center md:space-x-3">
            <Link
              to="/about"
              className="text-gray-600 hover:text-primary px-2 py-1.5 rounded-md text-sm font-extrabold"
            >
              {t("About Us")}
            </Link>
            <Link
              to="/programs"
              className="text-gray-600 hover:text-primary px-2 py-1.5 rounded-md text-sm font-extrabold"
            >
              {t("Programs")}
            </Link>
            <Link
              to="/curriculum"
              className="text-gray-600 hover:text-primary px-2 py-1.5 rounded-md text-sm font-extrabold"
            >
              {t("Curriculum & Materials")}
            </Link>
            <Link
              to="/terms"
              className="text-gray-600 hover:text-primary px-2 py-1.5 rounded-md text-sm font-extrabold"
            >
              {t("Terms & Conditions")}
            </Link>
            <Link
              to="/pricing"
              className="text-gray-600 hover:text-primary px-2 py-1.5 rounded-md text-sm font-extrabold"
            >
              {t("Pricing")}
            </Link>
            <Link
              to="/login"
              className="text-gray-600 hover:text-primary px-2 py-1.5 rounded-md text-sm font-extrabold"
            >
              {t("Login")}
            </Link>
          </nav>

          {/* Language Selector and Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            <div className="relative z-10">
              <Select value={i18n.language} onValueChange={changeLanguage}>
                <SelectTrigger id="language-select" className="w-[100px] sm:w-[120px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-primary hover:bg-gray-100 focus:outline-none transition-colors duration-200"
              onClick={toggleMenu}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Always rendered but height animated */}
      <div
        ref={menuRef}
        className="md:hidden bg-background border-t overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: `${menuHeight}px`, opacity: menuHeight > 0 ? 1 : 0 }}
        aria-hidden={!isMenuOpen}
      >
        <div className="container mx-auto px-4 py-3 space-y-2">
          <Link
            to="/about"
            className="block text-gray-600 hover:text-primary px-2 py-2 rounded-md text-base font-extrabold"
            onClick={() => setIsMenuOpen(false)}
          >
            {t("About Us")}
          </Link>
          <Link
            to="/programs"
            className="block text-gray-600 hover:text-primary px-2 py-2 rounded-md text-base font-extrabold"
            onClick={() => setIsMenuOpen(false)}
          >
            {t("Programs")}
          </Link>
          <Link
            to="/curriculum"
            className="block text-gray-600 hover:text-primary px-2 py-2 rounded-md text-base font-extrabold"
            onClick={() => setIsMenuOpen(false)}
          >
            {t("Curriculum & Materials")}
          </Link>
          <Link
            to="/terms"
            className="block text-gray-600 hover:text-primary px-2 py-2 rounded-md text-base font-extrabold"
            onClick={() => setIsMenuOpen(false)}
          >
            {t("Terms & Conditions")}
          </Link>
          <Link
            to="/pricing"
            className="block text-gray-600 hover:text-primary px-2 py-2 rounded-md text-base font-extrabold"
            onClick={() => setIsMenuOpen(false)}
          >
            {t("Pricing")}
          </Link>
          <Link
            to="/login"
            className="block text-gray-600 hover:text-primary px-2 py-2 rounded-md text-base font-extrabold"
            onClick={() => setIsMenuOpen(false)}
          >
            {t("Login")}
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Header

