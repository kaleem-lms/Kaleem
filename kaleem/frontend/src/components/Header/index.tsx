import { Link } from '@tanstack/react-router';
import { Bell, GraduationCap, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '../AuthContext';
import { HeaderDropdown } from './HeaderDropdown';

export default function Header() {
	const { user } = useAuth();

	return (
		<header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
			<nav className="hidden flex-col gap-6 font-medium text-lg md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
				<Link to="/dashboard" className="flex items-center gap-2 font-semibold text-lg md:text-base">
					<GraduationCap className="h-6 w-6" />
					<span>Kaleem</span>
				</Link>
				{user?.role === 'T' && (
					<Link to="/dashboard" className="text-nowrap text-foreground transition-colors hover:text-foreground">
						Dashboard
					</Link>
				)}
				<Link
					to={'/sessions'}
					className={cn('text-nowrap text-muted-foreground transition-colors hover:text-foreground', {
						'text-foreground': window.location.pathname === '/sessions',
					})}
				>
					Sessions
				</Link>
				{/* <Link
          href="#"
          className={cn(
            'text-muted-foreground transition-colors text-nowrap hover:text-foreground',
            {
              'text-foreground': window.location.pathname === '/messages',
            }
          )}
        >
          Messages
        </Link> */}
			</nav>
			<Sheet>
				<SheetTrigger asChild>
					<Button variant="outline" size="icon" className="shrink-0 md:hidden">
						<Menu className="h-5 w-5" />
						<span className="sr-only">Toggle navigation menu</span>
					</Button>
				</SheetTrigger>
				<SheetContent side="left">
					<nav className="grid gap-6 font-medium text-lg">
						<Link to="/" className="flex items-center gap-2 font-semibold text-lg">
							<GraduationCap className="h-6 w-6" />
							<span>Kaleem</span>
						</Link>
						{user?.role === 'T' && (
							<Link to="#" className="text-foreground hover:text-foreground">
								Dashboard
							</Link>
						)}
						<Link to={'/sessions'} className="text-muted-foreground hover:text-foreground">
							Sessions
						</Link>
						{/* <Link
              href="#"
              className="text-muted-foreground hover:text-foreground"
            >
              Messages
            </Link> */}
					</nav>
				</SheetContent>
			</Sheet>
			<div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
				<Button variant="ghost" size="icon">
					<Bell className="h-5 w-5" />
					<span className="sr-only">Notifications</span>
				</Button>
				<HeaderDropdown></HeaderDropdown>
			</div>
		</header>
	);
}
