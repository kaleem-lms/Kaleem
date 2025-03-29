import { getCurrentUser } from '@/api/axios'
import { useNavigate } from '@tanstack/react-router'
import React from 'react'
import { ReactNode, useEffect } from 'react'
import { LoadingScreen } from './LoadingScreen'

interface PrivateRouteProps {
  children: ReactNode
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  // const { user } = useAuth()
  const navigate = useNavigate()
  // console.log("User", user);
  // console.log()
  const user = localStorage.getItem('user_data')

  const [state, setState] = React.useState<'pending' | 'success' | 'error'>('pending')

  useEffect(() => {
    (async ()=>{
      /**
       * 
       * NOTE: make sure you follow these guides to leverage the loading mechanizim.
       * TODO: - [ ] when the user sign in set lcoal values in storage.
       * TODO: - [ ] when the user visits a protected route we gonna use the local user.
       * TODO: - [ ] simonteniously fetching the new user and updateing it if there's not user redirect `reditrect(/login)`
       * TODO: - [ ] the protected route will render and user the current user in the local, and if the `req` failed 'cause not `authd` redirect `reditrect(/login)` 
       * 
       * @alt you can use the suspense mechanizim.
       * 
       * @see https://react.dev/reference/react/Suspense
       * @see https://youtu.be/_FuDMEgIy7I?si=Dplbm1NYTzeog9Hu
       * @see https://youtu.be/SJjK_YWfngU?si=7hI49jLJ-d8tug47
       * 
       */

  const currentUser = await getCurrentUser()
    if (currentUser === null) {
      // console.log('you\'re not a suser')
      navigate({ to: '/login' })
    }
    setState('success')

    })()
  }, [user, navigate]) // This runs only when `user` changes

  if (state === 'pending') {
    // Optionally, return a loading indicator while waiting for user data
    return <LoadingScreen/>
  }

  return <>{children}</> // Render children only if the user is logged in
}

export default PrivateRoute
