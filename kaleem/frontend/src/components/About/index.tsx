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
} from 'lucide-react'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import Header from '@/components/Landing/Header'
import Footer from '@/components/Landing/Footer'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'

const AboutPage: React.FC = () => {
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
      <section className="py-12 md:py-20 bg-gradient-to-b from-primary/10 to-background">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter">
              About Kaleem Institute
            </h1>
            <p className="text-muted-foreground max-w-[700px] md:text-xl">
              Discover our journey, mission, and vision in providing excellence
              in Arabic and Islamic education
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 md:py-16">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
            <div className="space-y-4">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm">
                <BookOpenText className="inline-block mr-2 h-4 w-4" />
                Our Story
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                About Kaleem Institute
              </h2>
              <p className="text-muted-foreground md:text-lg">
                Kaleem Institute is an online learning platform dedicated to
                teaching Arabic, the Quran, Islamic sciences, and the Egyptian
                dialect to French-speaking students. Our educational approach
                combines academic excellence with accessibility, enabling
                students of all levels to progress in an interactive and
                engaging environment.
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <Button variant="outline" className="gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Our Courses
                </Button>
                <Button variant="outline" className="gap-2">
                  <BrainCircuit className="h-4 w-4" />
                  Our Methodology
                </Button>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden shadow-lg">
              <img
                src="/placeholder.svg?height=400&width=600"
                alt="Kaleem Institute Learning Environment"
                className="w-full h-auto object-cover aspect-video"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-12 md:py-16 bg-muted/50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <ScanEye className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Our Purpose
                  </span>
                </div>
                <CardTitle className="text-2xl">Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our mission is to provide high-quality education in Arabic and
                  Islamic sciences, facilitating access to linguistic and
                  religious knowledge. We support our students in learning the
                  Quran and Arabic language, helping them master these
                  disciplines while preserving their cultural and spiritual
                  heritage.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Our Aspiration
                  </span>
                </div>
                <CardTitle className="text-2xl">Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We aspire to become a global leader in teaching Arabic and
                  Islamic sciences, empowering learners to develop fluency and a
                  deep understanding of Islamic teachings. Our goal is to bridge
                  cultures and foster an authentic connection with the Arabic
                  language and Islamic tradition through an immersive and
                  enriching learning experience.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-12 md:py-16">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              Our Core Values
            </h2>
            <p className="text-muted-foreground mt-4 max-w-[700px] mx-auto">
              The principles that guide our educational approach and commitment
              to excellence
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Book className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Academic Excellence</h3>
                <p className="text-muted-foreground">
                  We are committed to providing the highest quality education
                  through structured curriculum and qualified instructors.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <Earth className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Cultural Bridge</h3>
                <p className="text-muted-foreground">
                  We connect French-speaking students with authentic Arabic
                  language and Islamic traditions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 p-3 w-12 h-12 flex items-center justify-center mb-4">
                  <ThumbsUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Accessibility</h3>
                <p className="text-muted-foreground">
                  We make quality education accessible to students of all levels
                  through our interactive online platform.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 md:py-16 bg-muted/50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              What Our Students Say
            </h2>
            <p className="text-muted-foreground mt-4 max-w-[700px] mx-auto">
              Hear from our community of learners about their experience with
              Kaleem Institute
            </p>
          </div>

          <Carousel className="w-full max-w-4xl mx-auto">
            <CarouselContent>
              {[1, 2, 3].map((index) => (
                <CarouselItem key={index} className="md:basis-1/1 lg:basis-1/1">
                  <Card className="border-none shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="rounded-full bg-primary/10 p-1">
                          <img
                            src={`/placeholder.svg?height=80&width=80&text=Student${index}`}
                            alt={`Student ${index}`}
                            className="rounded-full w-16 h-16"
                          />
                        </div>
                        <p className="text-muted-foreground italic">
                          "Kaleem Institute has transformed my understanding of
                          Arabic and the Quran. The teachers are exceptional and
                          the interactive learning environment makes every
                          lesson engaging."
                        </p>
                        <div>
                          <h4 className="font-semibold">Student Name</h4>
                          <p className="text-sm text-muted-foreground">
                            Arabic & Quran Student
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default AboutPage
