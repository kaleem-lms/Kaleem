import { createFileRoute } from '@tanstack/react-router';
import PricesPage from '@/components/Payments/Prices';

export const Route = createFileRoute('/(general)/pricing')({
	component: PricesPage,
});
