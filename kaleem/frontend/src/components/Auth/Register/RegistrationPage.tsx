import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Landing/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import RegistrationForm from './RegisterForm';
import RoleSelection from './RoleSelection';

type Role = 'student' | 'teacher' | 'parent' | null;

const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => {
	return (
		<div className="mb-4 flex justify-between">
			{Array.from({ length: totalSteps }).map((_, i) => {
				const stepKey = `step-${i + 1}-of-${totalSteps}`;
				return (
					<div
						key={stepKey}
						className={`h-2 w-full rounded-full ${i < currentStep ? 'bg-primary' : 'bg-gray-200'} ${i > 0 ? 'ml-1' : ''}`}
					/>
				);
			})}
		</div>
	);
};

const RegistrationPage: React.FC = () => {
	const { t } = useTranslation();
	const [step, setStep] = useState(1);
	const [role, setRole] = useState<Role>(null);

	const nextStep = () => setStep(step + 1);
	const prevStep = () => setStep(step - 1);

	const handleRoleSelect = (selectedRole: Role) => {
		setRole(selectedRole);
		nextStep();
	};

	const pageVariants = {
		initial: { opacity: 0, x: '-100%' },
		in: { opacity: 1, x: 0 },
		out: { opacity: 0, x: '100%' },
	};

	const pageTransition = {
		type: 'tween',
		ease: 'anticipate',
		duration: 0.5,
	};

	const getTotalSteps = () => {
		// if (role === 'teacher') return 3;
		if (role === 'student' || role === 'parent' || role === 'teacher') return 2;
		return 1;
	};

	return (
		<div className="flex min-h-screen flex-col bg-background text-foreground">
			<Header />
			<div className="flex flex-1 items-center justify-center bg-background">
				<Card className="w-full max-w-lg">
					<CardHeader>
						<CardTitle>{t('Register for Kaleem')}</CardTitle>
						<CardDescription>{t('Join our Quran learning platform')}</CardDescription>
					</CardHeader>
					<StepIndicator currentStep={step} totalSteps={getTotalSteps()} />
					<CardContent>
						<h2 className="mb-4 font-semibold text-lg">
							{t('Step')} {step} {t('of')} {getTotalSteps()}
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
								{step === 2 && <RegistrationForm nextStep={nextStep} role={role} />}
							</motion.div>
						</AnimatePresence>
					</CardContent>
					<CardFooter className="flex justify-between">
						{step > 1 && (
							<Button onClick={prevStep} variant="outline">
								{t('Back')}
							</Button>
						)}
						{step < 2 && step > 1 && role === 'teacher' && <Button onClick={nextStep}>{t('Next')}</Button>}
						<Link to="/login" className="text-muted-foreground underline">
							{t('Or you can login')}
						</Link>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
};

export default RegistrationPage;
