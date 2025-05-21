import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { User, Video, Bell, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import TeacherTimeSelection from '../Auth/Register/TeacherTimeSelection'

export const profileData = {
  profile: {
    name: 'John Doe',
    email: 'teacher@example.com',
    zoom_email: 'teacher.zoom@example.com',
    notifications: { email: true, sms: false },
  },
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(profileData.profile)
  const { toast } = useToast()

  const handleSaveProfile = () => {
    toast({
      title: 'Profile updated',
      description: 'Your profile information has been updated successfully.',
    })
  }

  const handleSaveNotifications = () => {
    toast({
      title: 'Notification preferences updated',
      description:
        'Your notification preferences have been updated successfully.',
    })
  }

  const handleSaveZoom = () => {
    toast({
      title: 'Zoom settings updated',
      description:
        'Your Zoom integration settings have been updated successfully.',
    })
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">
            Profile & Settings
          </h2>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="zoom">
              <Video className="mr-2 h-4 w-4" />
              Zoom Settings
            </TabsTrigger>
            <TabsTrigger value="timetable">
              <Calendar className="mr-2 h-4 w-4" />
              Timetable
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Tell your students about yourself"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveProfile}>Save Changes</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
              </CardContent>
              <CardFooter>
                <Button>Change Password</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Manage how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <Label
                    htmlFor="email-notifications"
                    className="flex flex-col space-y-1"
                  >
                    <span>Email Notifications</span>
                    <span className="font-normal text-sm text-muted-foreground">
                      Receive notifications via email
                    </span>
                  </Label>
                  <Switch
                    id="email-notifications"
                    checked={profile.notifications.email}
                    onCheckedChange={(checked) =>
                      setProfile({
                        ...profile,
                        notifications: {
                          ...profile.notifications,
                          email: checked,
                        },
                      })
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between space-x-2">
                  <Label
                    htmlFor="session-reminders"
                    className="flex flex-col space-y-1"
                  >
                    <span>Session Reminders</span>
                    <span className="font-normal text-sm text-muted-foreground">
                      Receive reminders before scheduled sessions
                    </span>
                  </Label>
                  <Switch id="session-reminders" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between space-x-2">
                  <Label
                    htmlFor="marketing-emails"
                    className="flex flex-col space-y-1"
                  >
                    <span>Marketing Emails</span>
                    <span className="font-normal text-sm text-muted-foreground">
                      Receive marketing and promotional emails
                    </span>
                  </Label>
                  <Switch id="marketing-emails" />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveNotifications}>
                  Save Preferences
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="zoom" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Zoom Integration</CardTitle>
                <CardDescription>
                  Configure your Zoom integration settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="zoom-email">Zoom Email</Label>
                  <Input
                    id="zoom-email"
                    type="email"
                    value={profile.zoom_email}
                    onChange={(e) =>
                      setProfile({ ...profile, zoom_email: e.target.value })
                    }
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveZoom}>Save Zoom Settings</Button>
              </CardFooter>
            </Card>

            {/* <Card>
              <CardHeader>
                <CardTitle>Meeting Defaults</CardTitle>
                <CardDescription>
                  Configure default settings for your Zoom meetings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="waiting-room" defaultChecked />
                  <Label htmlFor="waiting-room">Enable waiting room</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="host-video" defaultChecked />
                  <Label htmlFor="host-video">Start with host video on</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="participant-video" />
                  <Label htmlFor="participant-video">
                    Start with participant video on
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="mute-participants" defaultChecked />
                  <Label htmlFor="mute-participants">
                    Mute participants upon entry
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="recording" />
                  <Label htmlFor="recording">
                    Automatically record meetings
                  </Label>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Save Meeting Defaults</Button>
              </CardFooter>
            </Card> */}
          </TabsContent>

          <TabsContent value="timetable" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Zoom Integration</CardTitle>
                <CardDescription>
                  Configure your Zoom integration settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TeacherTimeSelection/>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveZoom}>Save Zoom Settings</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

