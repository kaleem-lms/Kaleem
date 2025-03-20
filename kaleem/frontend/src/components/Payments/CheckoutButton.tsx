import React from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { api } from '@/api/axios'
import { Button } from '../ui/button'
import { useTranslation } from 'react-i18next'
import { createCheckoutSession } from '@/api/axios'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from '@tanstack/react-router'

const stripePromise = loadStripe(
  'pk_test_51R2MYDKzvGrzIjASnK4PyVfdMlSxpImNAxKo47kkA69JD0r71g6GU1oBmfWCJgmx94fGtyuTWscuUjHI9etV1VhG00Z7ZkcixX'!
)

interface CheckoutButtonProps {
  planId: number | string
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
}

const CheckoutButton: React.FC<CheckoutButtonProps> = ({ planId, variant }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleCheckout = async () => {
    if (!user) {
      navigate({ to: '/login' })
      return;
    }
    try {
      const data = await createCheckoutSession(planId)
      console.log(data.sessionId)

      if (data.error) {
        console.error('Error from backend:', data.error)
        return
      }

      const stripe = await stripePromise
      if (!stripe) {
        console.error('Stripe failed to initialize')
        return
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (error) {
        console.error('Stripe error:', error.message)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  return (
    <Button className="w-full" variant={variant} onClick={handleCheckout}>
      {t('Subscribe Now')}
    </Button>
  )
}

export default CheckoutButton
