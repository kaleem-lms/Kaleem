import { loadStripe } from '@stripe/stripe-js';
import { useNavigate } from '@tanstack/react-router';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { createCheckoutSession } from '@/api/axios';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';

const stripePromise = loadStripe(
	'pk_live_51R2MYDKzvGrzIjASU5fAvjfbHTXtpfqaNUjwu0D09xF3Vh1zjfewPlreVn2gTIS2tEIidjvbuyw78B3vhQMfF8Dd00Zxvm1foe'!,
);

interface CheckoutButtonProps {
	planId: number | string;
	variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

const CheckoutButton: React.FC<CheckoutButtonProps> = ({ planId, variant }) => {
	const { t } = useTranslation();
	const { user } = useAuth();
	const navigate = useNavigate();

	const handleCheckout = async () => {
		if (!user) {
			navigate({ to: '/login' });
			return;
		}
		try {
			const data = await createCheckoutSession(planId);
			console.log(data.sessionId);

			if (data.error) {
				console.error('Error from backend:', data.error);
				return;
			}

			const stripe = await stripePromise;
			if (!stripe) {
				console.error('Stripe failed to initialize');
				return;
			}

			const { error } = await stripe.redirectToCheckout({
				sessionId: data.sessionId,
			});

			if (error) {
				console.error('Stripe error:', error.message);
			}
		} catch (err) {
			console.error('Unexpected error:', err);
		}
	};

	return (
		<Button className="w-full" variant={variant} onClick={handleCheckout}>
			{t('Subscribe Now')}
		</Button>
	);
};

export default CheckoutButton;
