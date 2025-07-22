import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { logoutUser } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Logout() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { toast } = useToast();

	const handleLogout = async () => {
		try {
			await logoutUser();
			toast({
				title: 'Logged out successfully',
				description: 'You have been securely logged out of your account.',
				className: 'bg-primary text-primary-foreground',
			});

			// Redirect to login page or home page
			navigate({ to: '/login' });
		} catch (error) {
			console.error('Logout failed:', error);
			toast({
				title: 'Logout failed',
				description: 'An error occurred while logging out. Please try again.',
				variant: 'destructive',
			});
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<Card className="w-[350px] border-primary/20 bg-primary/5">
				<CardHeader>
					<CardTitle className="text-primary">{t('Logout')}</CardTitle>
				</CardHeader>
				<CardContent className="pt-6">
					<p className="text-muted-foreground text-sm">
						{t('Are you sure you want to log out of your Quran learning session?')}
					</p>
				</CardContent>
				<CardFooter className="flex justify-end">
					<Button
						variant="outline"
						className="text-primary hover:bg-primary hover:text-primary-foreground"
						onClick={handleLogout}
					>
						{t('Logout')}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
