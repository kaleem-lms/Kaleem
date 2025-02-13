import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BookOpenText,
  Book,
  Crown,
  Earth,
  ScanEye,
  ThumbsUp,
  GraduationCap,
  Instagram,
  Facebook,
  BrainCircuit,
  Podcast,
} from 'lucide-react'
import { BsWhatsapp } from 'react-icons/bs'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import Header from './Header'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'

const LandingPage: React.FC = () => {
  const auth = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (auth.user) {
      navigate({ to: '/dashboard' })
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
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                      {t('Learn Quran with Kaleem')}
                    </h1>
                    <p className="text-lg md:text-xl mb-6">
                      {t(
                        'Discover the beauty of the Quran through our interactive and personalized learning platform.'
                      )}
                    </p>
                    <Link to="/register" className="self-start">
                      <Button className="w-fit text-lg px-6 py-3">
                        {t('Get Started')}
                      </Button>
                    </Link>
                  </div>
                  <div className="flex-1 bg-slate-300 hidden md:block">
                    {/* Add an image here */}
                    <img
                      src="/goals.jpg"
                      alt={t('Quran learning')}
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
            <h2 className="text-3xl font-bold leading-tight mb-4">
              {t('Why choose Kaleem?')}
            </h2>
            <p className="max-w-2xl mx-auto text-lg text-gray-600">
              {t(`Kaleem is designed to be the best platform for learning and teaching Quran. We are committed to providing
              a world-class experience for all of our users.`)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: GraduationCap,
                title: t('Expert Instructors'),
                description: t(
                  'Our teachers are highly qualified, with strong backgrounds in Arabic linguistics, Quranic studies, and Islamic sciences.'
                ),
              },
              {
                icon: Earth,
                title: t('Interactive Online Learning'),
                description: t(
                  'We use innovative teaching methods, including live classes, multimedia resources, and one-on-one coaching.'
                ),
              },
              {
                icon: ThumbsUp,
                title: t('Flexible and Accessible'),
                description: t(
                  'Study at your own pace from anywhere in the world.'
                ),
              },
              {
                icon: ScanEye,
                title: t('Focus on Francophone Learners'),
                description: t(
                  'Our courses are designed specifically for French speakers, making it easier to understand and learn.'
                ),
              },
              {
                icon: BookOpenText,
                title: t('Comprehensive Curriculum'),
                description: t(
                  'From learning to read Arabic to mastering the Quran and understanding Islamic sciences, we provide a holistic learning experience.'
                ),
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="transition-all duration-300 hover:shadow-lg"
              >
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
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('Our Programs')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Crown,
                title: t('Standard Arabic'),
                description: t(
                  'Develop a strong foundation in Arabic grammar, vocabulary, and communication skills, progressing from beginner to advanced levels.'
                ),
              },
              {
                icon: Book,
                title: t('Quran and Tajweed'),
                description: t(
                  'Learn the correct pronunciation and articulation of Quranic Arabic, apply Tajweed rules, and work towards Ijazah (certification in Quranic recitation).'
                ),
              },
              {
                icon: BrainCircuit,
                title: t('Islamic Sciences'),
                description: t(
                  'Gain deep knowledge of Fiqh (Islamic jurisprudence), Tafsir (Quranic exegesis), Hadith studies, and Aqeedah (Islamic creed) to strengthen your understanding of Islam.'
                ),
              },
              {
                icon: Podcast,
                title: t('Egyptian Accent and Culture'),
                description: t(
                  'Immerse yourself in the spoken Arabic of Egypt, one of the most widely understood dialects in the Arab world, while also discovering Egyptian customs and traditions.'
                ),
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="transition-all duration-300 hover:shadow-lg"
              >
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
          <h2 className="text-3xl font-bold mb-4">
            {t('Ready to start your Quran journey?')}
          </h2>
          <p className="text-xl mb-8">
            {t(
              'Join Kaleem today and experience the best way to learn and teach Quran online.'
            )}
          </p>
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
