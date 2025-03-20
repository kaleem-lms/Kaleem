"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import Header from "@/components/Landing/Header"
import { useTranslation } from "react-i18next"
import Footer from "@/components/Landing/Footer"
import { Button } from "@/components/ui/button"
import { getPlans } from "@/api/axios"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Users, User, Clock, Calendar, ChevronLeft, ChevronRight, Tag } from "lucide-react"
import { Link } from "@tanstack/react-router"
import type { SubscriptionPlan } from "@/types"
import CheckoutButton from "./CheckoutButton"

const PricesPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await getPlans()
        setPlans(response)
        console.log(response)
      } catch (error) {
        console.error("Error fetching plans:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlans()
  }, [])

  // Handle scroll events to update active card
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const handleScroll = () => {
      if (!scrollContainer) return

      const containerWidth = scrollContainer.clientWidth
      const scrollPosition = scrollContainer.scrollLeft
      const cardWidth = containerWidth / 3 // Assuming 3 visible cards

      // Calculate which card is most centered
      const newActiveIndex = Math.round(scrollPosition / cardWidth)
      setActiveIndex(Math.min(newActiveIndex, plans.length - 1))
    }

    scrollContainer.addEventListener("scroll", handleScroll)
    return () => scrollContainer.removeEventListener("scroll", handleScroll)
  }, [plans.length])

  // Scroll to a specific card
  const scrollToCard = (index: number) => {
    if (!scrollContainerRef.current) return

    const containerWidth = scrollContainerRef.current.clientWidth
    const cardWidth = containerWidth / 3
    const newScrollPosition = index * cardWidth

    scrollContainerRef.current.scrollTo({
      left: newScrollPosition,
      behavior: "smooth",
    })
  }

  // Handle next/previous buttons
  const handlePrevious = () => {
    const newIndex = Math.max(0, activeIndex - 1)
    setActiveIndex(newIndex)
    scrollToCard(newIndex)
  }

  const handleNext = () => {
    const newIndex = Math.min(plans.length - 1, activeIndex + 1)
    setActiveIndex(newIndex)
    scrollToCard(newIndex)
  }

  // Calculate discount percentage
  const calculateDiscount = (currentPrice: string, originalPrice: number): number => {
    const current = Number.parseFloat(currentPrice)
    return Math.round(((originalPrice - current) / originalPrice) * 100)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("Our Plans")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("Choose the perfect plan for your Quran learning journey")}
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Navigation buttons */}
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : plans.length > 0 ? (
            <>
              <button
                onClick={handlePrevious}
                disabled={activeIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-background rounded-full p-2 shadow-md disabled:opacity-30"
                aria-label="Previous plan"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <button
                onClick={handleNext}
                disabled={activeIndex === plans.length - 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-background rounded-full p-2 shadow-md disabled:opacity-30"
                aria-label="Next plan"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Scrollable container */}
              <div
                ref={scrollContainerRef}
                className="overflow-x-auto p-8 hide-scrollbar snap-x snap-mandatory"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                <div className="flex gap-4 px-12">
                  {plans.map((plan, index) => {
                    const originalPrice = Number.parseFloat(plan.price) * 1.5
                    const discountPercentage = calculateDiscount(plan.price, originalPrice)

                    return (
                      <div key={plan.id} className="min-w-[calc(100%/3-16px)] snap-center">
                        <Card
                          className={`flex flex-col h-full border-2 transition-all duration-300 shadow-lg ${
                            index === activeIndex
                              ? "border-primary scale-105 shadow-xl z-10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <CardHeader className="pb-2 relative">
                            <div className="absolute -right-2 -top-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                                <Tag className="w-3 h-3 mr-1" />
                                {discountPercentage}% {t("OFF")}
                              </span>
                            </div>
                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                            <CardDescription>
                              {plan.is_group ? t("Group Sessions") : t("Individual Sessions")}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="flex-grow">
                            <div className="mb-6">
                              <div className="flex flex-col mb-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-4xl font-bold">
                                    {plan.price}
                                    <span className="text-lg font-normal text-muted-foreground ml-1">{t("EUR")}</span>
                                  </p>
                                </div>
                                <div className="flex items-center">
                                  <p className="text-sm font-medium text-muted-foreground line-through decoration-2 decoration-red-500">
                                    {originalPrice.toFixed(2)} {t("EUR")}
                                  </p>
                                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-800 rounded-sm dark:bg-red-900 dark:text-red-200">
                                    {t("Save")} {discountPercentage}%
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {t("for")} {plan.duration_days} {t("days")}
                              </p>
                            </div>
                            <ul className="space-y-3">
                              <li className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-primary" />
                                <span>
                                  {plan.sessions_count} {t("sessions")}
                                </span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" />
                                <span>
                                  {plan.session_duration} {t("minutes per session")}
                                </span>
                              </li>
                              <li className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-primary" />
                                <span>
                                  {plan.duration_days} {t("days validity")}
                                </span>
                              </li>
                              <li className="flex items-center gap-2">
                                {plan.is_group ? (
                                  <Users className="h-5 w-5 text-primary" />
                                ) : (
                                  <User className="h-5 w-5 text-primary" />
                                )}
                                <span>{plan.is_group ? t("Group learning") : t("One-on-one learning")}</span>
                              </li>
                            </ul>
                          </CardContent>
                          <CardFooter>
                            <CheckoutButton planId={plan.id} variant={index === activeIndex ? "default" : "outline"} />
                          </CardFooter>
                        </Card>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Dots indicator */}
              <div className="flex justify-center gap-2 mt-4">
                {plans.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveIndex(index)
                      scrollToCard(index)
                    }}
                    className={`h-2 rounded-full transition-all ${
                      index === activeIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                    }`}
                    aria-label={`Go to plan ${index + 1}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 px-4 bg-muted/30 rounded-lg">
              <div className="max-w-md mx-auto">
                <h3 className="text-2xl font-bold mb-4">{t("No Plans Available")}</h3>
                <p className="text-muted-foreground mb-6">
                  {t(
                    "We currently don't have any subscription plans available. Please check back later or contact us for custom options.",
                  )}
                </p>
                <Link to="/contact">
                  <Button>{t("Contact Us")}</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 text-center bg-muted p-8 rounded-lg max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">{t("Need a Custom Plan?")}</h2>
          <p className="mb-6 text-muted-foreground">
            {t("Contact us for custom plans tailored to your specific learning needs and goals")}
          </p>
          <Link to="/contact">
            <Button variant="outline">{t("Contact Us")}</Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default PricesPage

