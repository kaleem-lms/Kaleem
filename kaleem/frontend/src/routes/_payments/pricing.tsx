import PricesPage from '@/components/Payments/Prices'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_payments/pricing')({
  component: () => <h1>Prices</h1> //PricesPage,
})
