import { Link, useLocation } from '@tanstack/react-router';
import { BookOpen, Calendar, CreditCard, Home, LogOut, Menu, Settings, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from './AuthContext';

const commonRoutes = [
	{
		name: 'Profile & Settings',
		path: '/settings',
		icon: Settings,
	},
	{
		name: 'Logout',
		path: '/logout',
		icon: LogOut,
	},
];

const roleBasedRoutes: Record<string, typeof commonRoutes> = {
	T: [
		{
			name: 'Students',
			path: '/students',
			icon: Users,
		},
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
			name: 'Resources',
			path: '/resources',
			icon: BookOpen,
		},
	],
	S: [
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
			name: 'Resources',
			path: '/resources',
			icon: BookOpen,
		},
		{
			name: 'Subscription',
			path: '/subscription',
			icon: CreditCard,
		},
	],
	P: [],
};

const routeOrder = ['Dashboard', 'Students', 'Sessions', 'Resources', 'Subscription', 'Profile & Settings', 'Logout'];

function getRoutesByRole(role?: string) {
	const allRoutes = [...(roleBasedRoutes[role ?? ''] || []), ...commonRoutes];
	return allRoutes.sort((a, b) => routeOrder.indexOf(a.name) - routeOrder.indexOf(b.name));
}

const roleMap: Record<string, string> = { T: 'Teacher', S: 'Student', P: 'Parent' };

export function Sidebar() {
	const location = useLocation();
	const { user } = useAuth();
	const [open, setOpen] = useState(false);

	const routes = getRoutesByRole(user?.role);

	const SidebarContent = () => (
		<div className="flex h-full flex-col gap-2">
			<div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
				<Link to="/" className="flex items-center gap-2 font-semibold">
					<BookOpen className="h-6 w-6" />
					<span>{roleMap[user?.role ?? ''] || ''} Dashboard</span>
				</Link>
			</div>
			<div className="flex-1 overflow-auto py-2">
				<nav className="grid items-start px-2 lg:px-4">
					{routes.map((route) => (
						<Link key={route.path} to={route.path} className="my-0.5" onClick={() => setOpen(false)}>
							<span
								className={cn(
									'group flex items-center rounded-md px-3 py-2 font-medium text-sm hover:bg-accent hover:text-accent-foreground',
									location.pathname === route.path ? 'bg-accent text-accent-foreground' : 'transparent',
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
						<AvatarImage src={user?.profile?.profile_image} className="object-cover" alt="profile image" />
						<AvatarFallback>{user?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
					</Avatar>
					<div className="flex flex-col min-w-0">
						<span className="font-medium text-sm">{user?.name}</span>
						<span className="text-muted-foreground text-xs truncate overflow-hidden whitespace-nowrap" title={user?.email}>
							{user?.email}
						</span>
					</div>
				</div>
			</div>
		</div>
	);

	return (
		<>
			{/* Mobile Sidebar */}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild className="md:hidden">
					<Button variant="outline" size="icon" className="absolute top-3 left-4 z-40">
						<Menu className="h-5 w-5" />
						<span className="sr-only">Toggle Menu</span>
					</Button>
				</SheetTrigger>
				<SheetContent side="left" className="w-64 p-0">
					<SidebarContent />
				</SheetContent>
			</Sheet>

			{/* Desktop Sidebar */}
			<div className="hidden border-r bg-muted/40 md:block md:w-80 lg:w-72">
				<SidebarContent />
			</div>
		</>
	);
}
