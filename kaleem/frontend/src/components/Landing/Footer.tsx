import { Link } from '@tanstack/react-router'
import { BsWhatsapp } from 'react-icons/bs'
import { Button } from '../ui/button'
import { Facebook, Instagram, Podcast } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  return (
    <>
      {/* Contact Section */}
      <section className="py-12 md:py-16" id='contact'>
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              {t("Connect With Us")}
            </h2>
            <p className="text-muted-foreground mt-4 max-w-[700px] mx-auto">
              {t(`Have questions about our programs? Reach out to us through any of
              these channels`)}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="https://instagram.com/kaleem.institute"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <Instagram className="h-4 w-4" />
                {t("Instagram")}
              </Button>
            </Link>
            <Link
              to="https://www.facebook.com/people/Institut-Kaleem/61573637921543/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <Facebook className="h-4 w-4" />
                {t("Facebook")}
              </Button>
            </Link>
            <Link
              to="https://wa.me/+33758711251"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <BsWhatsapp className="h-4 w-4" />
                {t("WhatsApp")}
              </Button>
            </Link>
            <Link to="/register" rel="noopener noreferrer">
              <Button className="gap-2">
                <Podcast className="h-4 w-4" />
                {t("Start Learning Today")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 md:py-8">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} {t(`Kaleem Institute. All rights
                reserved.`)}
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                to="/terms"
                className="text-sm text-muted-foreground hover:underline"
              >
                {t("Terms")}
              </Link>
              <Link
                to="/privacy"
                className="text-sm text-muted-foreground hover:underline"
              >
                {t("Privacy")}
              </Link>
              <Link
                to="/contact"
                className="text-sm text-muted-foreground hover:underline"
              >
                {t("Contact")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
