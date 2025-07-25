import { Link } from '@tanstack/react-router';
import { Award, BookMarked, BookOpen, CheckCircle2, GraduationCap, Languages } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import Footer from '@/components/Landing/Footer';
import Header from '@/components/Landing/Header';
import { Button } from '@/components/ui/button';

const CurriculumPage: React.FC = () => {
	const { t } = useTranslation();

	const curriculumCategories = [
		{
			id: 1,
			title: t("Qur'an Learning and Tajweed"),
			icon: <BookOpen className="h-10 w-10 text-primary" />,
			materials: [
				{
					id: 1,
					name: t('Nouraneyah Qaida'),
					description: t("A foundational book for beginners to master Arabic letters, pronunciation, and Qur'anic reading."),
				},
				{
					id: 2,
					name: t('Baghdadiya Qaida'),
					description: t("A traditional and effective method for teaching Arabic phonetics and Qur'anic recitation."),
				},
				{
					id: 3,
					name: t('Fath Ar-Rahman'),
					description: t('A renowned guide for learning the correct articulation of Arabic letters and Tajweed rules.'),
				},
				{
					id: 4,
					name: t('Tajweed Books from Al-Azhar'),
					description: t(
						'Comprehensive materials covering the theoretical and practical application of Tajweed rules, as taught in Azhari institutes.',
					),
				},
			],
		},
		{
			id: 2,
			title: t('Arabic Language Studies'),
			icon: <Languages className="h-10 w-10 text-primary" />,
			materials: [
				{
					id: 1,
					name: t('Al-Arabiyah Bayn Yadayk'),
					description: t(
						'A globally recognized Arabic language series designed to develop proficiency in Modern Standard Arabic through a structured approach.',
					),
				},
				{
					id: 2,
					name: t('Al-Manhaj Al-Alami'),
					description: t(
						'A comprehensive curriculum tailored for non-Arabic speakers, encompassing seven levels from introductory (A0) to advanced (C2). This series aligns with the Common European Framework of Reference for Languages (CEFR) standards, integrating language skills with a focus on practical usage.',
					),
				},
			],
		},
		{
			id: 3,
			title: t('Islamic Studies'),
			icon: <BookMarked className="h-10 w-10 text-primary" />,
			materials: [
				{
					id: 1,
					name: t('Islamic Studies Books from Al-Azhar Institutes'),
					description: t(
						'Covering Fiqh, Hadith, Tafsir, Aqeedah, and Seerah, these books provide deep and structured knowledge in various Islamic sciences.',
					),
				},
			],
		},
	];

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Header />

			<main className="container mx-auto px-4 py-12">
				{/* Hero Section */}
				<section className="mb-16 text-center">
					<h1 className="mb-6 font-bold text-4xl">{t('Curriculum and Materials')}</h1>
					<div className="mx-auto max-w-3xl">
						<p className="mb-6 text-lg">
							{t(
								"At Kaleem Institute, we ensure that all our courses are based on authentic, accredited materials that uphold the highest educational standards. Our curriculum is certified and accredited by Al-Azhar Al-Sharif, the world's leading Islamic institution, and is delivered by highly qualified Azhari tutors with expertise in Qur'anic and Islamic studies.",
							)}
						</p>
						<div className="mb-8 flex flex-wrap justify-center gap-4">
							<div className="flex items-center gap-2">
								<Award className="h-5 w-5 text-primary" />
								<span>{t('Al-Azhar Certified')}</span>
							</div>
							<div className="flex items-center gap-2">
								<GraduationCap className="h-5 w-5 text-primary" />
								<span>{t('Expert Azhari Tutors')}</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckCircle2 className="h-5 w-5 text-primary" />
								<span>{t('Authentic Materials')}</span>
							</div>
						</div>
					</div>
				</section>

				{/* Core Materials Section */}
				<section className="mb-16">
					<h2 className="mb-10 text-center font-bold text-3xl">{t('Our Core Materials')}</h2>

					<div className="grid gap-10">
						{curriculumCategories.map((category) => (
							<div key={category.id} className="overflow-hidden rounded-lg bg-card shadow-md">
								<div className="bg-primary/10 p-6">
									<div className="mb-4 flex items-center gap-4">
										{category.icon}
										<h3 className="font-bold text-2xl">{category.title}</h3>
									</div>
								</div>
								<div className="p-6">
									<ul className="grid gap-6 md:grid-cols-2">
										{category.materials.map((material) => (
											<li key={material.id} className="rounded-lg bg-muted/50 p-4">
												<h4 className="mb-2 font-semibold text-primary text-xl">{material.name}</h4>
												<p>{material.description}</p>
											</li>
										))}
									</ul>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Commitment Section */}
				<section className="mb-16 rounded-lg bg-primary/5 p-8 text-center">
					<h2 className="mb-6 font-bold text-2xl">{t('Our Commitment to Quality Education')}</h2>
					<p className="mx-auto max-w-3xl text-lg">
						{t(
							"At Kaleem Institute, we are committed to providing a rigorous and authentic curriculum that ensures a solid foundation in Qur'anic studies, Arabic language, and Islamic sciences. With certified materials and expert Azhari tutors, we guarantee a high-quality learning experience that preserves the essence of traditional Islamic education.",
						)}
					</p>
				</section>

				{/* CTA Section */}
				<section className="text-center">
					<h2 className="mb-6 font-bold text-2xl">{t('Ready to Begin Your Learning Journey?')}</h2>
					<Link to="/register">
						<Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
							{t('Enroll Now')}
						</Button>
					</Link>
				</section>
			</main>
			<Footer />
		</div>
	);
};

export default CurriculumPage;
