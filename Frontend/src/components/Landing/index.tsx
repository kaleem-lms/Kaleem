import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Calendar,
  Book,
  Users,
  Video,
  Instagram,
  Facebook,
  MessageCircleIcon as Message,
  ChevronRight,
} from "lucide-react"
import { BsWhatsapp } from "react-icons/bs"

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import Header from "./Header"
import { Link, useNavigate } from "@tanstack/react-router"
import { useAuth } from "@/hooks/useAuth"
import { useTranslation } from "react-i18next"

const LandingPage: React.FC = () => {
  const auth = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (auth.user) {
      navigate({ to: "/dashboard" })
    }
  }, [auth.user, navigate])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero Section */}
      <section className="relative">
        <Carousel className="w-full">
          <CarouselContent>
            {Array.from({ length: 5 }).map((_, index) => (
              <CarouselItem key={index}>
                <div className="flex flex-col md:flex-row h-[60vh] bg-gray-100">
                  <div className="flex flex-col justify-center flex-1 p-8 md:p-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('Learn Quran with Kaleem')}</h1>
                    <p className="text-lg md:text-xl mb-6">
                      {t('Discover the beauty of the Quran through our interactive and personalized learning platform.')}
                    </p>
                    <Link to="/register" className="self-start">
                      <Button className="w-fit text-lg px-6 py-3">{t('Get Started')}</Button>
                    </Link>
                  </div>
                  <div className="flex-1 bg-slate-300 hidden md:block">
                    {/* Add an image here */}
                    <img
                      src="/placeholder.svg?height=400&width=600"
                      alt={t("Quran learning")}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute left-4 top-1/2 transform -translate-y-1/2" />
          <CarouselNext className="absolute right-4 top-1/2 transform -translate-y-1/2" />
        </Carousel>
      </section>

      {/* Why Us Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold leading-tight mb-4">{t('Why choose Kaleem?')}</h2>
            <p className="max-w-2xl mx-auto text-lg text-gray-600">
              {t(`Kaleem is designed to be the best platform for learning and teaching Quran. We are committed to providing
              a world-class experience for all of our users.`)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Book,
                title: t("Easy to use"),
                description: t("Kaleem is designed to be easy to use, with a simple and intuitive interface."),
              },
              {
                icon: Users,
                title: t("Personalized"),
                description: t("Kaleem is designed to provide a personalized experience for each user."),
              },
              {
                icon: Calendar,
                title: t("Affordable"),
                description: t("Kaleem is an affordable platform for learning and teaching Quran."),
              },
            ].map((feature, index) => (
              <Card key={index} className="transition-all duration-300 hover:shadow-lg">
                <CardHeader>
                  <feature.icon className="w-12 h-12 text-primary mb-4" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t('Our Features')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Video,
                title: t("Live Classes"),
                description: t("Join interactive live classes with expert Quran teachers."),
              },
              {
                icon: Book,
                title: t("Comprehensive Curriculum"),
                description: t("Follow a structured curriculum designed for all levels."),
              },
              {
                icon: Users,
                title: t("Community Support"),
                description: t("Connect with fellow learners and share your journey."),
              },
              {
                icon: Calendar,
                title: t("Flexible Scheduling"),
                description: t("Choose class times that fit your busy lifestyle."),
              },
              {
                icon: Message,
                title: t("Instant Feedback"),
                description: t("Receive real-time feedback on your recitation and progress."),
              },
              {
                icon: ChevronRight,
                title: t("Progress Tracking"),
                description: t("Monitor your learning journey with detailed analytics."),
              },
            ].map((feature, index) => (
              <Card key={index} className="transition-all duration-300 hover:shadow-lg">
                <CardHeader>
                  <feature.icon className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">{t('Contact Us')}</h2>
          <p className="text-xl text-gray-600 mb-8">
            {t(`If you have any questions or need help, please don't hesitate to contact us. We're here to support your
            Quran learning journey.`)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://www.facebook.com/kaleem.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Facebook className="w-6 h-6" />
              <span>{t('Facebook')}</span>
            </a>
            <a
              href="https://www.instagram.com/kaleem.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-pink-600 hover:text-pink-800 transition-colors"
            >
              <Instagram className="w-6 h-6" />
              <span>{t('Instagram')}</span>
            </a>
            <a
              href="https://wa.me/+201114444444"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-green-600 hover:text-green-800 transition-colors"
            >
              <BsWhatsapp className="w-6 h-6" />
              <span>{t('WhatsApp')}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t('Ready to start your Quran journey?')}</h2>
          <p className="text-xl mb-8">{t('Join Kaleem today and experience the best way to learn and teach Quran online.')}</p>
          <Link to="/register">
            <Button variant="secondary" size="lg" className="text-lg px-8 py-4">
              {t('Get Started Now')}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}

export default LandingPage

