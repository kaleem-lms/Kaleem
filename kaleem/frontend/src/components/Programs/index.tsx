"use client"

import React from "react"
import Header from "@/components/Landing/Header"
import Footer from "@/components/Landing/Footer"
import { useNavigate } from "@tanstack/react-router"
import { useAuth } from "@/hooks/useAuth"
import { useTranslation } from "react-i18next"
import { Book, BookOpen, Languages, GraduationCap } from "lucide-react"

const ProgramsPage: React.FC = () => {
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

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{t("Our Programmes")}</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t(
              "At Kaleem Institute, we offer a diverse range of programmes tailored to meet the needs of students of all ages and backgrounds. Whether you are a beginner or seeking advanced Islamic studies, our structured courses provide a comprehensive learning experience.",
            )}
          </p>
        </div>

        {/* Qur'an Studies Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-8 w-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-semibold">{t("Qur'an Studies")}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Qur'an Recitation")}</h3>
              <p>
                {t(
                  "Personalized and group sessions for boys, girls, men, and women, ensuring correct pronunciation and fluency.",
                )}
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Qur'an Memorization")}</h3>
              <p>{t("Guided Hifz classes to help students memorize the Qur'an with precision and understanding.")}</p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Tajweed Sessions")}</h3>
              <p>{t("Learn the rules of Tajweed to recite the Qur'an beautifully and correctly.")}</p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Ijazah Certification")}</h3>
              <p>
                {t(
                  "Advanced training for students aiming for Ijazah (certification) in Qur'anic recitation or memorization.",
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Arabic Language Programmes */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Languages className="h-8 w-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-semibold">{t("Arabic Language Programmes")}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Arabic Basics for Qur'an Reading")}</h3>
              <p>
                {t("A foundational course focusing on Arabic script, pronunciation, and fluency in Qur'anic reading.")}
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Standard Arabic (General)")}</h3>
              <p>
                {t(
                  "A structured programme covering grammar, vocabulary, and sentence structure for formal Arabic proficiency.",
                )}
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Arabic Conversation")}</h3>
              <p>
                {t(
                  "Practical sessions designed to enhance speaking and comprehension skills in Modern Standard Arabic.",
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Islamic Studies */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Book className="h-8 w-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-semibold">{t("Islamic Studies")}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("General Islamic Studies")}</h3>
              <p>
                {t("Covering essential topics in faith, worship, and Islamic history to build a strong foundation.")}
              </p>
            </div>
            <div className="bg-card rounded-lg p-6 shadow-sm border">
              <h3 className="text-xl font-medium mb-3">{t("Specialized Islamic Courses")}</h3>
              <p>
                {t(
                  "In-depth studies in Fiqh (Islamic jurisprudence), Hadith (Prophetic traditions), Tafsir (Qur'anic exegesis), Seerah (Prophetic biography), and more.",
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-primary/10 rounded-xl p-8 text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-semibold mb-4">{t("Join Our Learning Community")}</h2>
          <p className="text-lg mb-6 max-w-3xl mx-auto">
            {t(
              "Whether you are looking to improve your Qur'an recitation, master the Arabic language, or deepen your Islamic knowledge, Kaleem Institute provides expert guidance in a supportive learning environment.",
            )}
          </p>
          <button
            onClick={() => navigate({ to: "/register" })}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium transition-colors"
          >
            {t("Join Us Today")}
          </button>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default ProgramsPage

