import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import RootComponent from '@/components/root-component'
import { QueryClient, queryOptions } from '@tanstack/react-query'
import { getCurrentUser } from '@/api/axios'

type RootRouteWithContextType = {
    queryClient: QueryClient
}

const userQueryOptions = queryOptions({
    queryKey: ['user'],
    queryFn: getCurrentUser,
})

export const Route = createRootRouteWithContext<RootRouteWithContextType>()({
    component: Outlet,
    loader: async ({ context: { queryClient } }) => {
        const user = await queryClient.ensureQueryData(userQueryOptions)
        return user
    },
    notFoundComponent: () => (
        <div className="text-red-500 text-5xl font-bold">Not Found</div>
    ),
})
