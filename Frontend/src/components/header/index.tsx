import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Logout from '@/components/auth/logout'
import { Link } from '@tanstack/react-router'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Bell, GraduationCap, Menu, Search } from 'lucide-react'
import { getCurrentUser } from '@/api/axios'
import { useQuery } from '@tanstack/react-query'
import { User } from '@/types'
import { Button } from '@/components/ui/button'

export default function Header() {
    const { data: user } = useQuery<User | null>({
        queryKey: ['user'],
        queryFn: getCurrentUser,
        refetchOnWindowFocus: false,
    })

    return (
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
                <Link
                    href="#"
                    className="flex items-center gap-2 text-lg font-semibold md:text-base"
                >
                    <GraduationCap className="h-6 w-6" />
                    <span>Kaleem</span>
                </Link>
                <Link
                    href="#"
                    className="text-foreground transition-colors text-nowrap hover:text-foreground"
                >
                    Dashboard
                </Link>
                <Link
                    href="#"
                    className="text-muted-foreground transition-colors text-nowrap hover:text-foreground"
                >
                    My Courses
                </Link>
                <Link
                    href="#"
                    className="text-muted-foreground transition-colors text-nowrap hover:text-foreground"
                >
                    Calendar
                </Link>
                <Link
                    href="#"
                    className="text-muted-foreground transition-colors text-nowrap hover:text-foreground"
                >
                    Messages
                </Link>
            </nav>
            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left">
                    <nav className="grid gap-6 text-lg font-medium">
                        <Link
                            href="#"
                            className="flex items-center gap-2 text-lg font-semibold"
                        >
                            <GraduationCap className="h-6 w-6" />
                            <span>Kaleem LMS</span>
                        </Link>
                        <Link
                            href="#"
                            className="text-foreground hover:text-foreground"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="#"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            My Courses
                        </Link>
                        <Link
                            href="#"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Calendar
                        </Link>
                        <Link
                            href="#"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Messages
                        </Link>
                    </nav>
                </SheetContent>
            </Sheet>
            <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4 justify-end">
                <form className="ml-auto flex-1 sm:flex-initial">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search courses..."
                            className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                        />
                    </div>
                </form>
                <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full"
                        >
                            <Avatar>
                                <AvatarImage src={user?.profile.picture} />
                                <AvatarFallback>
                                    {user?.name.slice(0, 2).toUpperCase() ||
                                        'GS'}
                                </AvatarFallback>
                            </Avatar>
                            <span className="sr-only">Toggle user menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Profile</DropdownMenuItem>
                        <DropdownMenuItem>Grades</DropdownMenuItem>
                        <DropdownMenuItem>Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Logout />
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
