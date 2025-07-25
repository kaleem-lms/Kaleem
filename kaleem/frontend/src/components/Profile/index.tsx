import { Calendar, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeacherTimeSelection from '../Auth/Register/TeacherTimeSelection';
import { toast } from '@/hooks/use-toast';
import { getProfile, updateUser } from '@/api/axios';
import type { Profile } from '@/types';

export default function ProfilePage() {
	const [profile, setProfile] = useState<Profile>();

	useEffect(() => {
		getProfile().then((data) => {
			setProfile(data);
		});
	}, []);

	const handleSaveProfile = async () => {
		try {
			await updateUser(profile);

			toast({
				title: 'Profile updated',
				description: 'Your profile information has been updated successfully.',
			});
		} catch (error) {
			console.error('Failed to update profile:', error);
			toast({
				title: 'Update failed',
				description: 'There was an error updating your profile. Please try again.',
				variant: 'destructive',
			});
		}
	};

	const handleSaveZoom = () => {
		toast({
			title: 'Zoom settings updated',
			description: 'Your Zoom integration settings have been updated successfully.',
		});
	};

	return (
		<div className="flex flex-col">
			<div className="flex-1 space-y-4 p-8 pt-6">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="font-bold text-3xl tracking-tight">Profile & Settings</h2>
				</div>

				<Tabs defaultValue="profile" className="space-y-4">
					<TabsList>
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

					<TabsContent value="profile" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Personal Information</CardTitle>
								<CardDescription>Update your personal information</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
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

						{/* <Card>
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
						</Card> */}
					</TabsContent>

					<TabsContent value="timetable" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Zoom Integration</CardTitle>
								<CardDescription>Configure your Zoom integration settings</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<TeacherTimeSelection />
							</CardContent>
							<CardFooter>
								<Button onClick={handleSaveZoom}>Save Zoom Settings</Button>
							</CardFooter>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
