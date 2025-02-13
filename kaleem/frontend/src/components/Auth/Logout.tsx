import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast'

import { logoutUser } from '@/api/axios'
import { useNavigate } from '@tanstack/react-router'

export default function Logout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logoutUser()
      toast({
        title: "Logged out successfully",
        description: "You have been securely logged out of your account.",
        className: "bg-primary text-primary-foreground",
      })

      // Redirect to login page or home page
      navigate({ to: '/login' })
    } catch (error) {
      console.error('Logout failed:', error)
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[350px] border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-primary">{t('Logout')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            {t('Are you sure you want to log out of your Quran learning session?')}
          </p>
        </CardContent>
        <CardFooter className="flex justify-end bg-primary/5">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-primary hover:bg-primary hover:text-primary-foreground">
                {t('Logout')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-background border-primary/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-primary">{t('Are you absolutely sure?')}</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {t('This action will log you out of your account. You will need to log in again to access your Quran learning sessions.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-primary hover:bg-primary/10">{t('Cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isLoggingOut ? 'Logging out...' : 'Confirm Logout'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  )
}

