import CurriculumPage from '@/components/Curriculum'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/curriculum/')({
  component: CurriculumPage,
})
