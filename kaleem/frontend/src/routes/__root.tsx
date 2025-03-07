import NotFoundPage from '@/components/404'
import { AuthProvider } from '@/components/AuthContext'
import { FullPageLoading } from '@/components/Pending'
import {
  createRootRouteWithContext,
  Outlet,
} from '@tanstack/react-router'
// import LayoutProvider from '@/components/Layouts/LayoutProvider'
// import RootComponent from '@/components/root-component'
// import { getCurrentUser } from '@/api/axios'

// const userQueryOptions = queryOptions({
//     queryKey: ['user'],
//     queryFn: getCurrentUser,
// })

export const Route = createRootRouteWithContext()({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
  // loader: async ({ context: { queryClient } }) => {
  //     const user = await queryClient.ensureQueryData(userQueryOptions)
  //     return user
  // },
  notFoundComponent: NotFoundPage,
  pendingComponent: FullPageLoading,
})
