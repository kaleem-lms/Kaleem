import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useTheme } from '../ThemeProvider'
import TeacherTimeSelection from '../Auth/Register/TeacherTimeSelection'
import { getTimeSlots } from '@/api/axios'
import { useAuth } from '@/hooks/useAuth'
import { TeacherTimeslot } from '@/types'

// Mock function to fetch user data - replace with actual API call
// const fetchUserData = async () => {
//   // Simulating an API call
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       resolve({ role: 'teacher', name: 'John Doe' })
//     }, 3000) // Increased timeout to 3 seconds to show loading screen
//   })
// }

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [timeSlots, setTimeSlots] = useState<TeacherTimeslot[]>([])
  const { setTheme, theme } = useTheme()
  const { user } = useAuth()

  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!user) {
          console.error('User data not available')
          return
        }
        const data = await getTimeSlots(user?.id)

        setTimeSlots(data)
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [])

  console.log(timeSlots)

  if (isLoading) return <LoadingScreen />
  if (user?.role !== 'T')
    return <div>Access Denied. Teacher role required.</div>

  return (
    <div className="container mx-auto py-10 max-sm:px-4">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <Tabs defaultValue="timetable" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="timetable">
          <TeacherTimeSelection />
        </TabsContent>
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize your view.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? 'dark' : 'light')
                  }
                />
                <Label htmlFor="dark-mode">Dark Mode</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <input
                  id="name"
                  defaultValue={user?.name}
                  className="w-full p-2 border rounded"
                />
              </div>
              <Button
                className="mt-4"
                onClick={() => console.log('Update profile clicked')}
              >
                Update Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
