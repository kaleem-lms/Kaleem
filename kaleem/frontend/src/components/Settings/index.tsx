import { Calendar, Camera, Settings, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProfile, updateProfileImage, updateUser } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import type { Profile } from '@/types';
import TeacherTimeSelection from '../Auth/Register/TeacherTimeSelection';
import { useTheme } from '../ThemeProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export default function SettingsPage() {
	const { i18n, t } = useTranslation();
	const { theme, setTheme } = useTheme();
	const [profile, setProfile] = useState<Profile>();
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			// Create preview URL
			const previewUrl = URL.createObjectURL(file);
			setAvatarPreview(previewUrl);

			updateProfileImage(file)
				.then(() => {
					toast({
						title: 'Profile picture updated',
						description: 'Your profile picture has been updated successfully.',
					});
				})
				.catch(() => {
					toast({
						variant: 'destructive',
						title: 'Failed to update profile picture',
						description: 'Your profile picture failed to updated.',
					});
				});
		}
	};

	const handleAvatarClick = () => {
		fileInputRef.current?.click();
	};

	const getInitials = (name: string) => {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase();
	};

	useEffect(() => {
		getProfile().then((data) => {
			setProfile(data);
		});
	}, []);

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
	};

	const handleSaveProfile = async () => {
		try {
			delete profile?.profile.profile_image;
			await updateUser(profile);

			toast({
				title: 'Profile updated',
				description: 'Your profile information has been updated successfully.',
			});
		} catch (error) {
			const errors = error.response?.data;

			let errorMessage = 'There was an error updating your profile. Please try again.';
			if (errors && typeof errors === 'object') {
				// Flatten messages like { email: ["User with this Email Address already exists."] }
				const messages = Object.entries(errors)
					.map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
					.join('\n');
				if (messages) errorMessage = messages;
			}

			toast({
				title: 'Update failed',
				description: errorMessage,
				variant: 'destructive',
			});
		}
	};

	return (
		<div className="flex flex-col">
			<div className="flex-1 space-y-4 p-8 pt-6">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="font-bold text-3xl tracking-tight">Profile & Settings</h2>
				</div>

				<Tabs defaultValue="settings" className="space-y-4">
					<TabsList>
						<TabsTrigger value="settings">
							<Settings className="mr-2 h-4 w-4" />
							Settings
						</TabsTrigger>
						<TabsTrigger value="profile">
							<User className="mr-2 h-4 w-4" />
							Profile
						</TabsTrigger>
						{profile?.role === 'T' && (
							<TabsTrigger value="timetable">
								<Calendar className="mr-2 h-4 w-4" />
								Timetable
							</TabsTrigger>
						)}
					</TabsList>

					<TabsContent value="settings" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>App Settings</CardTitle>
								<CardDescription>Customize your app experience</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-2">
									<Label htmlFor="theme">Theme</Label>
									<div className="flex items-center space-x-2">
										<Label htmlFor="theme-toggle" className="text-sm font-normal">
											Light
										</Label>
										<Switch
											id="theme-toggle"
											checked={theme === 'dark'}
											onCheckedChange={(checked: boolean) => {
												setTheme(checked ? 'dark' : 'light');
											}}
										/>
										<Label htmlFor="theme-toggle" className="text-sm font-normal">
											Dark
										</Label>
									</div>
									<p className="text-sm text-muted-foreground">Choose between light and dark mode for the interface</p>
								</div>

								<div className="space-y-2">
									<Label htmlFor="language">Language</Label>
									<Select value={i18n.language} onValueChange={changeLanguage}>
										<SelectTrigger id="language-select" className="w-[100px] sm:w-[120px]">
											<SelectValue placeholder="Language" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="en">English</SelectItem>
											<SelectItem value="ar">العربية</SelectItem>
											<SelectItem value="fr">Français</SelectItem>
										</SelectContent>
									</Select>
									<p className="text-sm text-muted-foreground">Select your preferred language for the interface</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="profile" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Personal Information</CardTitle>
								<CardDescription>Update your personal information</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Profile Picture</Label>
									<div className="flex items-center gap-4">
										<Avatar className="h-24 w-24">
											<AvatarImage src={avatarPreview || profile?.profile.profile_image} alt={profile?.name} />
											<AvatarFallback className="text-2xl">{profile?.name && getInitials(profile?.name)}</AvatarFallback>
										</Avatar>
										<div className="flex flex-col gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={handleAvatarClick}
												className="gap-2 bg-transparent"
											>
												<Camera className="h-4 w-4" />
												Change Photo
											</Button>
											<input
												ref={fileInputRef}
												type="file"
												accept="image/*"
												onChange={handleAvatarChange}
												className="hidden"
												aria-label="Upload profile picture"
											/>
											<p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB.</p>
										</div>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="name">Full Name</Label>
									<Input
										id="name"
										value={profile?.name}
										onChange={(e) => setProfile((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										value={profile?.email}
										onChange={(e) => setProfile((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
									/>
								</div>
								{profile?.role === 'T' && (
									<div className="space-y-2">
										<Label htmlFor="zoom-email">Zoom Email</Label>
										<Input
											id="zoom-email"
											type="email"
											value={profile?.zoom_email ?? ''}
											onChange={(e) => setProfile((prev) => (prev ? { ...prev, zoom_email: e.target.value } : prev))}
										/>
									</div>
								)}
								<div className="space-y-2">
									<Label htmlFor="bio">Bio</Label>
									<textarea
										id="bio"
										value={profile?.profile.bio || ''}
										onChange={(e) =>
											setProfile((prev) =>
												prev
													? {
															...prev,
															profile: {
																...prev.profile,
																bio: e.target.value,
															},
														}
													: prev,
											)
										}
										className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
										placeholder="Tell your students about yourself"
									/>
								</div>
							</CardContent>
							<CardFooter>
								<Button onClick={handleSaveProfile}>Save Changes</Button>
							</CardFooter>
						</Card>
					</TabsContent>

					<TabsContent value="timetable" className="space-y-4">
						<Card>
							<CardContent className="space-y-4">
								<TeacherTimeSelection />
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
