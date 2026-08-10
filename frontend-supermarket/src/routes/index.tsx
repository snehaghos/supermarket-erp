import { createFileRoute } from '@tanstack/react-router'
import { PortfolioLayout } from '@/features/portfolio-main/components/portfoliolayout'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <PortfolioLayout />
}
