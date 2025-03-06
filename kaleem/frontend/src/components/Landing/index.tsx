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
  BrainCircuit,
  Podcast,
} from 'lucide-react'

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
import Footer from './Footer'

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
            {[
              {
                title: t('Welcome to Kaleem Institute'),
                description: t(
                  'Kaleem Institute is an online educational platform dedicated to teaching Arabic, the Quran, Islamic sciences, and the Egyptian accent to French-speaking learners worldwide. Our goal is to make Arabic and Islamic knowledge accessible, engaging, and immersive, enabling students to connect with the language and their faith in a meaningful way.'
                ),
                image: '/kaleem.jpg',
              },
              {
                title: t('Learn, Understand, and Connect'),
                description: t(
                  'Whether you are a complete beginner or an advanced learner, our structured courses provide step-by-step guidance to help you achieve fluency in Arabic, master Quranic recitation with Tajweed, and deepen your understanding of Islamic sciences.'
                ),
                image: '/2.jpg',
              },
              {
                title: t('Unlock the Beauty of Arabic'),
                description: t(
                  "Immerse yourself in the richness of the Arabic language with engaging lessons, expert instructors, and practical exercises. Whether you're a beginner or looking to refine your skills, our structured approach ensures a smooth and enjoyable learning journey. Start speaking Arabic with confidence today!"
                ),
                image: '/3.jpg',
              },
              {
                title: t('Enlightening Hearts, Empowering Minds'),
                description: t(
                  `At Kaleem Institute, we are dedicated to preserving the beauty of Quranic recitation through Tajweed, fostering fluency in Arabic and strengthening Islamic knowledge. Our mission is to equip students with the tools to deepen their faith, connect with the Quran, and confidently engage with the Arabic language in their daily lives.`
                ),
                image: '/goals.jpg',
              },
            ].map((obj, index) => (
              <CarouselItem key={index}>
                <div className="flex flex-col md:flex-row h-[60vh] bg-gray-100 select-none">
                  <div className="flex flex-col justify-center flex-1 p-8 md:p-16">
                    <h1 className="text-4xl md:text-4xl font-bold mb-4">
                      {obj.title}
                    </h1>
                    <p className="text-lg md:text-md mb-6">
                      {obj.description}
                    </p>
                    <Link to="/register" className="self-start">
                      <Button className="w-fit text-lg px-6 py-3">
                        {t('Get Started')}
                      </Button>
                    </Link>
                  </div>
                  <div className="flex-2 bg-slate-300 hidden md:block">
                    {/* Add an image here */}
                    <img
                      src={obj.image}
                      alt={t('Quran learning')}
                      className="w-full h-full object-contain"
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

      <Footer />
    </div>
  )
}

export default LandingPage
