
import { useLocation } from '@tanstack/react-router'
import {
  BookOpen,
  Calendar,
  CreditCard,
  Home,
  Settings,
  Users,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Link } from '@tanstack/react-router'

export function Sidebar() {
  const location = useLocation()

  const routes = [
    {
      name: 'Dashboard',
      path: '/',
      icon: Home,
    },
    {
      name: 'Sessions',
      path: '/sessions',
      icon: Calendar,
    },
    {
      name: 'Students',
      path: '/students',
      icon: Users,
    },
    {
      name: 'Resources',
      path: '/resources',
      icon: BookOpen,
    },
    {
      name: 'Subscription',
      path: '/subscription',
      icon: CreditCard,
    },
    {
      name: 'Profile & Settings',
      path: '/profile',
      icon: Settings,
    },
  ]

  return (
    <div className="hidden border-r bg-muted/40 md:block md:w-64 lg:w-72">
      <div className="flex h-full flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-6 w-6" />
            <span>Teacher Dashboard</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 lg:px-4">
            {routes.map((route) => (
              <Link key={route.path} to={route.path}>
                <span
                  className={cn(
                    'group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                    location.pathname === route.path ? 'bg-accent' : 'transparent',
                  )}
                >
                  <route.icon className="mr-2 h-4 w-4" />
                  <span>{route.name}</span>
                </span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="flex items-center gap-2 rounded-lg border p-4">
            <Avatar>
              <AvatarImage src="/placeholder.svg" alt="John Doe" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">John Doe</span>
              <span className="text-xs text-muted-foreground">
                teacher@example.com
              </span>
            </div>
            <Button variant="ghost" size="icon" className="ml-auto">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
