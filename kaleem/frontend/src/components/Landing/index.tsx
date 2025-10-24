import { Link } from '@tanstack/react-router';
import {
	Book,
	BookOpenText,
	BrainCircuit,
	Crown,
	Earth,
	GraduationCap,
	ScanEye,
	ThumbsUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from '@/components/ui/carousel';
import i18n from '@/i18n';
import Footer from './Footer';
import Header from './Header';

const LandingPage: React.FC = () => {
	const { t } = useTranslation();
	const [dir, setDir] = useState(i18n.dir());

	useEffect(() => {
		const newDir = i18n.dir();
		document.documentElement.dir = newDir;
		setDir(newDir);
	}, []);

	return (
		<div className="min-h-screen bg-background text-foreground transition-colors">
			<Header />

			{/* Hero Section */}
			<section className="relative">
				<Carousel
					className="w-full"
					opts={{
						direction: dir,
						loop: true,
					}}
				>
					<CarouselContent>
						{[
							{
								id: 1,
								title: t('Welcome to Kaleem Institute'),
								description: t(
									'Kaleem Institute is an online educational platform dedicated to teaching Arabic, the Quran, Islamic sciences, and the Egyptian accent to French-speaking learners worldwide.',
								),
								image: '/kaleem.jpg',
							},
							{
								id: 2,
								title: t('Learn, Understand, and Connect'),
								description: t(
									'Whether you are a complete beginner or an advanced learner, our structured courses provide step-by-step guidance.',
								),
								image: '/2.jpg',
							},
							{
								id: 3,
								title: t('Unlock the Beauty of Arabic'),
								description: t(
									"Immerse yourself in the richness of the Arabic language with engaging lessons, expert instructors, and practical exercises.",
								),
								image: '/3.jpg',
							},
							{
								id: 4,
								title: t('Enlightening Hearts, Empowering Minds'),
								description: t(
									'At Kaleem Institute, we are dedicated to preserving the beauty of Quranic recitation and fostering fluency in Arabic.',
								),
								image: '/goals.jpg',
							},
						].map((obj) => (
							<CarouselItem key={obj.id}>
								<div className="flex h-[60vh] select-none flex-col bg-card md:flex-row">
									<div className="flex flex-1 flex-col justify-center p-8 md:p-16">
										<h1 className="mb-4 font-bold text-4xl md:text-4xl">{obj.title}</h1>
										<p className="mb-6 text-lg md:text-md text-muted-foreground">{obj.description}</p>
										<Link to="/register" className="self-start">
											<Button className="w-fit px-6 py-3 text-lg">{t('Get Started')}</Button>
										</Link>
									</div>
									<div className="hidden flex-2 bg-muted md:block">
										<img
											src={obj.image}
											alt={t('Quran learning')}
											className="h-full w-full object-contain rounded-lg"
										/>
									</div>
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
					<CarouselPrevious className="-translate-y-1/2 absolute top-1/2 left-4 transform" />
					<CarouselNext className="-translate-y-1/2 absolute top-1/2 right-4 transform" />
				</Carousel>
			</section>

			{/* Why Us Section */}
			<section className="bg-card px-4 py-16 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl">
					<div className="mb-12 text-center">
						<h2 className="mb-4 font-bold text-3xl leading-tight">{t('Why choose Kaleem?')}</h2>
						<p className="mx-auto max-w-2xl text-muted-foreground text-lg">
							{t(
								`Kaleem is designed to be the best platform for learning and teaching Quran. We are committed to providing a world-class experience for all of our users.`,
							)}
						</p>
					</div>

					<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
						{[
							{
								id: 1,
								icon: GraduationCap,
								title: t('Expert Instructors'),
								description: t(
									'Our teachers are highly qualified, with strong backgrounds in Arabic linguistics, Quranic studies, and Islamic sciences.',
								),
							},
							{
								id: 2,
								icon: Earth,
								title: t('Interactive Online Learning'),
								description: t(
									'We use innovative teaching methods, including live classes, multimedia resources, and one-on-one coaching.',
								),
							},
							{
								id: 3,
								icon: ThumbsUp,
								title: t('Flexible and Accessible'),
								description: t('Study at your own pace from anywhere in the world.'),
							},
							{
								id: 4,
								icon: ScanEye,
								title: t('Focus on Francophone Learners'),
								description: t(
									'Our courses are designed specifically for French speakers, making it easier to understand and learn.',
								),
							},
							{
								id: 5,
								icon: BookOpenText,
								title: t('Comprehensive Curriculum'),
								description: t(
									'From learning to read Arabic to mastering the Quran and understanding Islamic sciences, we provide a holistic learning experience.',
								),
							},
						].map((feature) => (
							<Card
								key={feature.id}
								className="transition-all duration-300 hover:shadow-lg bg-card text-card-foreground"
							>
								<CardHeader>
									<feature.icon className="mb-4 h-12 w-12 text-primary" />
									<CardTitle>{feature.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground">{feature.description}</p>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* Programs Section */}
			<section className="bg-muted px-4 py-16 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl">
					<h2 className="mb-12 text-center font-bold text-3xl">{t('Our Programs')}</h2>
					<div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
						{[
							{
								id: 1,
								icon: Crown,
								title: t('Standard Arabic'),
								description: t(
									'Develop a strong foundation in Arabic grammar, vocabulary, and communication skills.',
								),
							},
							{
								id: 2,
								icon: Book,
								title: t('Quran and Tajweed'),
								description: t(
									'Learn the correct pronunciation and articulation of Quranic Arabic, apply Tajweed rules, and work towards Ijazah.',
								),
							},
							{
								id: 3,
								icon: BrainCircuit,
								title: t('Islamic Sciences'),
								description: t(
									'Gain deep knowledge of Fiqh, Tafsir, Hadith, and Aqeedah to strengthen your understanding of Islam.',
								),
							},
						].map((feature) => (
							<Card
								key={feature.id}
								className="transition-all duration-300 hover:shadow-lg bg-card text-card-foreground"
							>
								<CardHeader>
									<feature.icon className="mb-2 h-8 w-8 text-primary" />
									<CardTitle>{feature.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground">{feature.description}</p>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
};

export default LandingPage;
