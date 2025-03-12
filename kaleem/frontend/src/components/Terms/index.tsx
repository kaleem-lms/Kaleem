import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Crown,
  GraduationCap,
  Calendar,
  CreditCard,
  RefreshCw,
  Clock,
  UserCheck,
  BookOpen,
  Gift,
  Shirt,
  LogOut,
  Lock,
} from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import Header from '@/components/Landing/Header'
import Footer from '@/components/Landing/Footer'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'

const TermsPage: React.FC = () => {
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

      <main className="container mx-auto py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
            {t('Terms & Conditions')}
          </h1>
          <p className="text-center text-muted-foreground mb-12">
            {t(
              'Please read these Terms & Conditions carefully before enrolling in our online courses. By joining Kaleem Institute, you agree to be bound by these Terms.'
            )}
          </p>

          <Accordion type="single" collapsible className="w-full mb-12">
            <AccordionItem value="payment">
              <AccordionTrigger className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <span>{t('Payment & Subscription Policy')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t(
                      'Payments are securely processed through PayPal, Stripe, Credit Card, or Bank Transfer.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Monthly subscriptions are paid in advance and automatically renewed every four weeks or after completing the required hours, considering holidays, pauses, or rescheduling.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Any updates regarding payment policies will be communicated in advance.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Students can cancel, pause, or modify their subscription at any time with a full money-back guarantee.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="refund">
              <AccordionTrigger className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                <span>{t('Refund Policy')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t(
                      'If you decide to pause or discontinue your classes, we will refund 100% of the unused sessions.'
                    )}
                  </li>
                  <li>
                    {t('To request a refund, email')}{' '}
                    <strong>{t('support@kaleeminstitute.com')}</strong>{' '}
                    {t('or contact our Support Team via Live Chat at least')}{' '}
                    <strong>{t('2-3 days')}</strong>{' '}
                    {t('before stopping the course.')}
                  </li>
                  <li>
                    {t(
                      'Missed study hours within a subscription period must be rescheduled with the teacher as soon as possible. If rescheduling is not feasible, a refund will be issued for the due classes.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="makeup">
              <AccordionTrigger className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{t('Make-up Classes')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t('Cancellations or rescheduling require')}{' '}
                    <strong>{t("at least 2 hours' notice")}</strong>{' '}
                    {t(
                      'before the class time. Students are entitled to a maximum of'
                    )}{' '}
                    <strong>{t('two make-up classes per month')}</strong>{' '}
                    {t('(except in emergencies).')}
                  </li>
                  <li>
                    {t(
                      'If a student plans a holiday, they must notify their teacher or Support Team.'
                    )}
                  </li>
                  <li>
                    {t('Missed classes without prior notice')}{' '}
                    <strong>{t('will not')}</strong>{' '}
                    {t('be rescheduled, except in emergencies.')}
                  </li>
                  <li>
                    {t(
                      'If a tutor cancels a class due to an emergency, they must notify the student, and the session will be rescheduled.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="schedule">
              <AccordionTrigger className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span>{t('Monthly Class Schedule')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t(
                      'The agreed-upon number of classes/hours will be determined at the time of enrollment.'
                    )}
                  </li>
                  <li>
                    {t(
                      'If a student wishes to modify the number of classes, they must inform their teacher or contact'
                    )}{' '}
                    <strong>{t('support@kaleeminstitute.com')}</strong>.
                  </li>
                  <li>
                    {t(
                      'If extra classes exceed the agreed-upon limit (e.g., a month with five Saturdays instead of four), the additional session will be canceled or rescheduled as a make-up class.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="holidays">
              <AccordionTrigger className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{t('Public Holidays')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="mb-2">
                  {t(
                    'According to the Islamic calendar, Kaleem Institute observes the following holidays:'
                  )}
                </p>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    <strong>{t('Eid Al-Fitr')}</strong> ({t('3 days')})
                  </li>
                  <li>
                    <strong>{t('Eid Al-Adha')}</strong> ({t('4 days')})
                  </li>
                </ol>
                <p className="mt-2">
                  {t('No make-up classes will be provided for these holidays.')}
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="progress">
              <AccordionTrigger className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                <span>{t('Progress Tracking & Reporting')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t(
                      'Parents of students under 16 years old will receive a quarterly progress report every three months.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Feedback from students and parents is encouraged to enhance learning experiences and optimize services.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="policies">
              <AccordionTrigger className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                <span>{t('Student & Tutor Policies')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t(
                      'Male students under 12 can be taught by either male or female teachers, based on parental preference.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Female students under 12 can be taught by either male or female teachers, based on parental preference.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Tutors are strictly prohibited from arranging private classes with students outside the Kaleem Institute.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="environment">
              <AccordionTrigger className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <span>{t('Learning Environment & Quality Control')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t(
                      'We ensure a professional and supportive learning environment for all students.'
                    )}
                  </li>
                  <li>
                    {t('Tutors are available to assist students at all times.')}
                  </li>
                  <li>
                    {t(
                      'The quality of education is regularly monitored through attendance records, teacher training, student feedback, and periodic assessments.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="punctuality">
              <AccordionTrigger className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span>{t('Teacher Punctuality')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t(
                      'If a teacher is late, students should email their teacher immediately.'
                    )}
                  </li>
                  <li>
                    {t('If the teacher does not respond, students must notify')}{' '}
                    <strong>{t('support@kaleeminstitute.com')}</strong>.
                  </li>
                  <li>
                    {t(
                      'Any missed classes due to teacher delays will be rescheduled.'
                    )}
                  </li>
                  <li>
                    {t(
                      'If a teacher frequently misses or delays classes, students should report this to the Support Team.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="scholarships">
              <AccordionTrigger className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                <span>{t('Scholarships & Special Packages')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t('Orphans may receive a 50% discount or free courses.')}
                  </li>
                  <li>
                    {t(
                      'Low-income families have access to affordable programs.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gifting">
              <AccordionTrigger className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                <span>{t('Gifting Courses')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  {t(
                    'Students can gift courses to family or friends. To do so:'
                  )}
                </p>
                <ol className="list-decimal pl-6 space-y-2 mt-2">
                  <li>{t('Visit our website.')}</li>
                  <li>{t('Go to Contact > Gift Voucher.')}</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="dress">
              <AccordionTrigger className="flex items-center gap-2">
                <Shirt className="h-5 w-5" />
                <span>{t('Dress Code')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  {t(
                    'Students should wear modest clothing suitable for Quran and Islamic studies classes.'
                  )}
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="leaving">
              <AccordionTrigger className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                <span>{t('Leaving the Institute')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  {t(
                    'If a student wishes to withdraw from the course, they must notify the Support Team at'
                  )}{' '}
                  <strong>{t('support@kaleeminstitute.com')}</strong>{' '}
                  {t('or via Live Chat at least two days in advance.')}
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="privacy">
              <AccordionTrigger className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                <span>{t('Privacy & Confidentiality')}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    {t('We are committed to protecting student privacy.')}
                  </li>
                  <li>
                    {t(
                      'Personal information is kept confidential and used solely for educational purposes.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Our systems use SSL encryption to safeguard user data.'
                    )}
                  </li>
                  <li>
                    {t(
                      'Student records are retained for 12 months after account cancellation, after which they are permanently deleted.'
                    )}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="text-center">
            <Button
              variant="default"
              size="lg"
              onClick={() => navigate({ to: '/' })}
            >
              {t('Back to Home')}
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default TermsPage
