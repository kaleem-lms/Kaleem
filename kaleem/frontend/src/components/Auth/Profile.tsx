import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, UserIcon, Briefcase, FileText } from 'lucide-react'
import { User } from '@/types'
import { getCurrentUser } from '@/api/axios'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        const userData = await getCurrentUser()
        setUser(userData)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [])

  if (isLoading) {
    return <ProfileSkeleton />
  }

  if (!user) {
    return <div className="text-center">User not found.</div>
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">User Profile</h1>
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col items-center mb-6">
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={user.profile.picture} alt={user.name} />
              <AvatarFallback className="text-2xl">
                {user.name.slice(0, 2).toUpperCase() || 'GS'}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-semibold">{user.name}</h2>
          </div>
          <div className="grid gap-4">
            <ProfileItem
              icon={<Mail className="w-5 h-5" />}
              label="Email"
              value={user.email}
            />
            <ProfileItem
              icon={<UserIcon className="w-5 h-5" />}
              label="Gender"
              value={user.gender}
            />
            <ProfileItem
              icon={<Briefcase className="w-5 h-5" />}
              label="Role"
              value={
                user.role === 'T'
                  ? 'Teacehr'
                  : user.role === 'P'
                    ? 'Parent'
                    : 'Student'
              }
            />
            <ProfileItem
              icon={<FileText className="w-5 h-5" />}
              label="Bio"
              value={user.profile.bio || 'Empty'}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center space-x-3 p-3 rounded-md bg-muted/50">
      <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardContent className="p-6">
        <div className="flex flex-col items-center mb-6">
          <Skeleton className="w-24 h-24 rounded-full mb-4" />
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-3 p-3 rounded-md bg-muted/50"
            >
              <Skeleton className="w-5 h-5" />
              <div className="flex-grow">
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
