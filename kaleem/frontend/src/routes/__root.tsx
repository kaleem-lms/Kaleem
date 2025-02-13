import { AuthProvider } from '@/components/AuthContext'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
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
  notFoundComponent: () => (
    <div className="text-red-500 text-5xl font-bold">Not Found</div>
  ),
})
