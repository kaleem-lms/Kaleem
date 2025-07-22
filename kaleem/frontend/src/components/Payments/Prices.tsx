import { Link } from '@tanstack/react-router';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Tag, User, Users } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPlans } from '@/api/axios';
import Footer from '@/components/Landing/Footer';
import Header from '@/components/Landing/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { SubscriptionPlan } from '@/types';
import CheckoutButton from './CheckoutButton';

const PricesPage: React.FC = () => {
	const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [activeIndex, setActiveIndex] = useState(0);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const { t } = useTranslation();

	useEffect(() => {
		const fetchPlans = async () => {
			try {
				const response = await getPlans();
				setPlans(response);
				console.log(response);
			} catch (error) {
				console.error('Error fetching plans:', error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchPlans();
	}, []);

	// Handle scroll events to update active card
	useEffect(() => {
		const scrollContainer = scrollContainerRef.current;
		if (!scrollContainer) return;

		const handleScroll = () => {
			if (!scrollContainer) return;

			const containerWidth = scrollContainer.clientWidth;
			const scrollPosition = scrollContainer.scrollLeft;

			// Responsive card width calculation
			let cardsPerView = 1; // Mobile default
			if (containerWidth >= 1024)
				cardsPerView = 3; // Large screens
			else if (containerWidth >= 768) cardsPerView = 2; // Medium screens

			const cardWidth = containerWidth / cardsPerView;

			// Calculate which card is most centered
			const newActiveIndex = Math.round(scrollPosition / cardWidth);
			setActiveIndex(Math.min(newActiveIndex, plans.length - 1));
		};

		scrollContainer.addEventListener('scroll', handleScroll);
		return () => scrollContainer.removeEventListener('scroll', handleScroll);
	}, [plans.length]);

	// Scroll to a specific card
	const scrollToCard = (index: number) => {
		if (!scrollContainerRef.current) return;

		const containerWidth = scrollContainerRef.current.clientWidth;

		// Responsive card width calculation
		let cardsPerView = 1; // Mobile default
		if (containerWidth >= 1024)
			cardsPerView = 3; // Large screens
		else if (containerWidth >= 768) cardsPerView = 2; // Medium screens

		const cardWidth = containerWidth / cardsPerView;
		const newScrollPosition = index * cardWidth;

		scrollContainerRef.current.scrollTo({
			left: newScrollPosition,
			behavior: 'smooth',
		});
	};

	// Handle next/previous buttons
	const handlePrevious = () => {
		const newIndex = Math.max(0, activeIndex - 1);
		setActiveIndex(newIndex);
		scrollToCard(newIndex);
	};

	const handleNext = () => {
		const newIndex = Math.min(plans.length - 1, activeIndex + 1);
		setActiveIndex(newIndex);
		scrollToCard(newIndex);
	};

	// Calculate discount percentage
	const calculateDiscount = (currentPrice: string, originalPrice: number): number => {
		const current = Number.parseFloat(currentPrice);
		return Math.round(((originalPrice - current) / originalPrice) * 100);
	};

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Header />

			<main className="container mx-auto px-4 py-8 md:py-16">
				<div className="mb-8 text-center md:mb-12">
					<h1 className="mb-3 font-bold text-3xl md:mb-4 md:text-4xl">{t('Our Plans')}</h1>
					<p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
						{t('Choose the perfect plan for your Quran learning journey')}
					</p>
				</div>

				<div className="relative mx-auto max-w-5xl">
					{/* Navigation buttons */}
					{isLoading ? (
						<div className="flex items-center justify-center py-20">
							<div className="h-12 w-12 animate-spin rounded-full border-primary border-b-2"></div>
						</div>
					) : plans.length > 0 ? (
						<>
							<button
								onClick={handlePrevious}
								disabled={activeIndex === 0}
								className="-translate-y-1/2 -translate-x-2 md:-translate-x-4 absolute top-1/2 left-0 z-10 rounded-full bg-background p-1 shadow-md disabled:opacity-30 md:p-2"
								aria-label="Previous plan"
							>
								<ChevronLeft className="h-4 w-4 md:h-6 md:w-6" />
							</button>

							<button
								onClick={handleNext}
								disabled={activeIndex === plans.length - 1}
								className="-translate-y-1/2 absolute top-1/2 right-0 z-10 translate-x-2 rounded-full bg-background p-1 shadow-md disabled:opacity-30 md:translate-x-4 md:p-2"
								aria-label="Next plan"
							>
								<ChevronRight className="h-4 w-4 md:h-6 md:w-6" />
							</button>

							{/* Scrollable container */}
							<div
								ref={scrollContainerRef}
								className="hide-scrollbar snap-x snap-mandatory overflow-x-auto p-4 md:p-8"
								style={{
									scrollbarWidth: 'none',
									msOverflowStyle: 'none',
								}}
							>
								<div className="flex gap-4 px-4 md:px-12">
									{plans.map((plan, index) => {
										const originalPrice = Number.parseFloat(plan.price) * 1.5;
										const discountPercentage = calculateDiscount(plan.price, originalPrice);

										return (
											<div
												key={plan.id}
												className="min-w-[85%] snap-center sm:min-w-[70%] md:min-w-[calc(100%/2-16px)] lg:min-w-[calc(100%/3-16px)]"
											>
												<Card
													className={`flex h-full flex-col border-2 shadow-lg transition-all duration-300 ${
														index === activeIndex
															? 'z-10 scale-105 border-primary shadow-xl'
															: 'border-border hover:border-primary/50'
													}`}
												>
													<CardHeader className="relative pb-2">
														<div className="-right-2 -top-2 absolute">
															<span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground text-xs">
																<Tag className="mr-1 h-3 w-3" />
																{discountPercentage}% {t('OFF')}
															</span>
														</div>
														<CardTitle className="text-2xl">{plan.name}</CardTitle>
														<CardDescription>{plan.is_group ? t('Group Sessions') : t('Individual Sessions')}</CardDescription>
													</CardHeader>
													<CardContent className="flex-grow">
														<div className="mb-4 md:mb-6">
															<div className="mb-2 flex flex-col">
																<div className="flex items-center gap-2">
																	<p className="font-bold text-3xl md:text-4xl">
																		{plan.price}
																		<span className="ml-1 font-normal text-base text-muted-foreground md:text-lg">{t('EUR')}</span>
																	</p>
																</div>
																<div className="flex items-center">
																	<p className="font-medium text-muted-foreground text-sm line-through decoration-2 decoration-red-500">
																		{originalPrice.toFixed(2)} {t('EUR')}
																	</p>
																	<span className="ml-2 rounded-sm bg-red-100 px-1.5 py-0.5 text-red-800 text-xs dark:bg-red-900 dark:text-red-200">
																		{t('Save')} {discountPercentage}%
																	</span>
																</div>
															</div>
															<p className="text-muted-foreground text-sm">
																{t('for')} {plan.duration_days} {t('days')}
															</p>
														</div>
														<ul className="space-y-3">
															<li className="flex items-center gap-2">
																<Check className="h-5 w-5 text-primary" />
																<span>
																	{plan.sessions_count} {t('sessions')}
																</span>
															</li>
															<li className="flex items-center gap-2">
																<Clock className="h-5 w-5 text-primary" />
																<span>
																	{plan.session_duration} {t('minutes per session')}
																</span>
															</li>
															<li className="flex items-center gap-2">
																<Calendar className="h-5 w-5 text-primary" />
																<span>
																	{plan.duration_days} {t('days validity')}
																</span>
															</li>
															<li className="flex items-center gap-2">
																{plan.is_group ? <Users className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
																<span>{plan.is_group ? t('Group learning') : t('One-on-one learning')}</span>
															</li>
														</ul>
													</CardContent>
													<CardFooter>
														<CheckoutButton planId={plan.id} variant={index === activeIndex ? 'default' : 'outline'} />
													</CardFooter>
												</Card>
											</div>
										);
									})}
								</div>
							</div>

							{/* Dots indicator */}
							<div className="mt-4 flex justify-center gap-2">
								{plans.map((_, index) => (
									<button
										key={index}
										onClick={() => {
											setActiveIndex(index);
											scrollToCard(index);
										}}
										className={`h-2 rounded-full transition-all ${
											index === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
										}`}
										aria-label={`Go to plan ${index + 1}`}
									/>
								))}
							</div>
						</>
					) : (
						<div className="rounded-lg bg-muted/30 px-4 py-16 text-center">
							<div className="mx-auto max-w-md">
								<h3 className="mb-4 font-bold text-2xl">{t('No Plans Available')}</h3>
								<p className="mb-6 text-muted-foreground">
									{t(
										"We currently don't have any subscription plans available. Please check back later or contact us for custom options.",
									)}
								</p>
								<Link to="/contact">
									<Button>{t('Contact Us')}</Button>
								</Link>
							</div>
						</div>
					)}
				</div>

				<div className="mx-auto mt-10 max-w-3xl rounded-lg bg-muted p-4 text-center md:mt-16 md:p-8">
					<h2 className="mb-4 font-bold text-2xl">{t('Need a Custom Plan?')}</h2>
					<p className="mb-6 text-muted-foreground">
						{t('Contact us for custom plans tailored to your specific learning needs and goals')}
					</p>
					<Link to="/contact">
						<Button variant="outline">{t('Contact Us')}</Button>
					</Link>
				</div>
			</main>

			<Footer />
		</div>
	);
};

export default PricesPage;
