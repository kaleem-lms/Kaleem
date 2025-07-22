'use client';

import { useNavigate } from '@tanstack/react-router';
import { Book, BookOpen, GraduationCap, Languages } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import Footer from '@/components/Landing/Footer';
import Header from '@/components/Landing/Header';
import { useAuth } from '../AuthContext';

const ProgramsPage: React.FC = () => {
	const auth = useAuth();
	const { t } = useTranslation();
	const navigate = useNavigate();

	React.useEffect(() => {
		if (auth.user) {
			navigate({ to: '/dashboard' });
		}
	}, [auth.user, navigate]);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Header />

			<main className="container mx-auto max-w-6xl px-4 py-12">
				<div className="mb-12 text-center">
					<h1 className="mb-4 font-bold text-3xl md:text-4xl">{t('Our Programmes')}</h1>
					<p className="mx-auto max-w-3xl text-lg text-muted-foreground">
						{t(
							'At Kaleem Institute, we offer a diverse range of programmes tailored to meet the needs of students of all ages and backgrounds. Whether you are a beginner or seeking advanced Islamic studies, our structured courses provide a comprehensive learning experience.',
						)}
					</p>
				</div>

				{/* Qur'an Studies Section */}
				<section className="mb-16">
					<div className="mb-6 flex items-center gap-3">
						<BookOpen className="h-8 w-8 text-primary" />
						<h2 className="font-semibold text-2xl md:text-3xl">{t("Qur'an Studies")}</h2>
					</div>
					<div className="grid gap-6 md:grid-cols-2">
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t("Qur'an Recitation")}</h3>
							<p>
								{t(
									'Personalized and group sessions for boys, girls, men, and women, ensuring correct pronunciation and fluency.',
								)}
							</p>
						</div>
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t("Qur'an Memorization")}</h3>
							<p>{t("Guided Hifz classes to help students memorize the Qur'an with precision and understanding.")}</p>
						</div>
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t('Tajweed Sessions')}</h3>
							<p>{t("Learn the rules of Tajweed to recite the Qur'an beautifully and correctly.")}</p>
						</div>
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t('Ijazah Certification')}</h3>
							<p>
								{t("Advanced training for students aiming for Ijazah (certification) in Qur'anic recitation or memorization.")}
							</p>
						</div>
					</div>
				</section>

				{/* Arabic Language Programmes */}
				<section className="mb-16">
					<div className="mb-6 flex items-center gap-3">
						<Languages className="h-8 w-8 text-primary" />
						<h2 className="font-semibold text-2xl md:text-3xl">{t('Arabic Language Programmes')}</h2>
					</div>
					<div className="grid gap-6 md:grid-cols-3">
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t("Arabic Basics for Qur'an Reading")}</h3>
							<p>{t("A foundational course focusing on Arabic script, pronunciation, and fluency in Qur'anic reading.")}</p>
						</div>
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t('Standard Arabic (General)')}</h3>
							<p>
								{t(
									'A structured programme covering grammar, vocabulary, and sentence structure for formal Arabic proficiency.',
								)}
							</p>
						</div>
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t('Arabic Conversation')}</h3>
							<p>{t('Practical sessions designed to enhance speaking and comprehension skills in Modern Standard Arabic.')}</p>
						</div>
					</div>
				</section>

				{/* Islamic Studies */}
				<section className="mb-16">
					<div className="mb-6 flex items-center gap-3">
						<Book className="h-8 w-8 text-primary" />
						<h2 className="font-semibold text-2xl md:text-3xl">{t('Islamic Studies')}</h2>
					</div>
					<div className="grid gap-6 md:grid-cols-2">
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t('General Islamic Studies')}</h3>
							<p>{t('Covering essential topics in faith, worship, and Islamic history to build a strong foundation.')}</p>
						</div>
						<div className="rounded-lg border bg-card p-6 shadow-sm">
							<h3 className="mb-3 font-medium text-xl">{t('Specialized Islamic Courses')}</h3>
							<p>
								{t(
									"In-depth studies in Fiqh (Islamic jurisprudence), Hadith (Prophetic traditions), Tafsir (Qur'anic exegesis), Seerah (Prophetic biography), and more.",
								)}
							</p>
						</div>
					</div>
				</section>

				{/* Call to Action */}
				<section className="rounded-xl bg-primary/10 p-8 text-center">
					<GraduationCap className="mx-auto mb-4 h-12 w-12 text-primary" />
					<h2 className="mb-4 font-semibold text-2xl">{t('Join Our Learning Community')}</h2>
					<p className="mx-auto mb-6 max-w-3xl text-lg">
						{t(
							"Whether you are looking to improve your Qur'an recitation, master the Arabic language, or deepen your Islamic knowledge, Kaleem Institute provides expert guidance in a supportive learning environment.",
						)}
					</p>
					<button
						type="button"
						onClick={() => navigate({ to: '/register' })}
						className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						{t('Join Us Today')}
					</button>
				</section>
			</main>

			<Footer />
		</div>
	);
};

export default ProgramsPage;
