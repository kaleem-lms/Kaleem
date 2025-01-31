import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import RoleSelection from './RoleSelection'
import RegistrationForm from './RegisterForm'
import TeacherTimeSelection from './TeacherTimeSelection'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'

type Role = 'student' | 'teacher' | 'parent' | null

const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({
  currentStep,
  totalSteps,
}) => {
  return (
    <div className="flex justify-between mb-4">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`w-full h-2 rounded-full ${
            i < currentStep ? 'bg-primary' : 'bg-gray-200'
          } ${i > 0 ? 'ml-1' : ''}`}
        />
      ))}
    </div>
  )
}

const RegistrationPage: React.FC = () => {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role>(null)

  const nextStep = () => setStep(step + 1)
  const prevStep = () => setStep(step - 1)

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole)
    nextStep()
  }

  const pageVariants = {
    initial: { opacity: 0, x: '-100%' },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: '100%' },
  }

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.5,
  }

  const getTotalSteps = () => {
    if (role === 'teacher') return 3
    if (role === 'student' || role === 'parent') return 2
    return 1
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('Register for Kaleem')}</CardTitle>
          <CardDescription>Join our Quran learning platform</CardDescription>
        </CardHeader>
        <StepIndicator currentStep={step} totalSteps={getTotalSteps()} />
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">
            Step {step} of {getTotalSteps()}
          </h2>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              {step === 1 && <RoleSelection onSelect={handleRoleSelect} />}
              {step === 2 && (
                <RegistrationForm
                  nextStep={nextStep}
                  role={role}
                />
              )}
              {step === 3 && role === 'teacher' && (
                <TeacherTimeSelection/>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 && (
            <Button onClick={prevStep} variant="outline">
              Back
            </Button>
          )}
          {(step < 2 && step>1 &&  role === 'teacher') && (
            <Button onClick={nextStep}>Next</Button>
          )}
        <Link to="/login" className='text-muted-foreground underline'>Or you can login</Link>
        </CardFooter>
      </Card>
    </div>
  )
}

export default RegistrationPage
