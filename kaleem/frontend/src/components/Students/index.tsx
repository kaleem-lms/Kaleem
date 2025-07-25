import { CalendarDays, Clock, Search, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTeacherStudents } from '@/api/axios';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Student } from '@/types';


const getGenderBadge = (gender: string) => {
	switch (gender.toLowerCase()) {
		case 'male':
			return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
		case 'female':
			return 'bg-pink-500/10 text-pink-500 hover:bg-pink-500/20';
		default:
			return '';
	}
};

export default function StudentsPage() {
	const [searchTerm, setSearchTerm] = useState('');
	const [students, setStudents] = useState<Student[]>([]);

	useEffect(() => {
		getTeacherStudents().then((data) => {
			setStudents(data);
		});
	}, []);

	return (
		<div className="flex flex-col">
			<div className="flex-1 space-y-4 p-8 pt-6">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="font-bold text-3xl tracking-tight">Students</h2>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Manage Students</CardTitle>
						<CardDescription>View and manage all your students</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col space-y-4">
							<div className="relative">
								<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search by student name..."
									className="pl-8"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
							</div>

							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Name</TableHead>
											<TableHead>Age</TableHead>
											<TableHead>Gender</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{students.map((student) => (
											<TableRow key={student.id}>
												<TableCell className="font-medium">{student.user.name}</TableCell>
												<TableCell>{student.age}</TableCell>
												<TableCell>
													<Badge className={getGenderBadge(student.user.gender)} variant="outline">
														{student.user.gender}
													</Badge>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Dialog>
															<DialogTrigger asChild>
																<Button size="sm" variant="outline">
																	View Profile
																</Button>
															</DialogTrigger>
															<DialogContent className="max-w-md">
																<DialogHeader className="text-center pb-2">
																	<DialogTitle className="text-xl">Student Profile</DialogTitle>
																</DialogHeader>

																{/* Profile Header */}
																<div className="flex flex-col items-center space-y-4 py-6">
																	<Avatar className="h-24 w-24 ring-2 ring-border">
																		<AvatarImage
																			src={student.user?.profile?.picture || '/placeholder.svg?height=96&width=96&query=student+avatar'}
																			className="object-cover"
																			alt={`${student.user.name}'s profile picture`}
																		/>
																		<AvatarFallback className="text-lg font-semibold">
																			{student.user.name
																				.split(' ')
																				.map((name) => name[0])
																				.join('')
																				.toUpperCase()
																				.slice(0, 2)}
																		</AvatarFallback>
																	</Avatar>

																	<div className="text-center space-y-1">
																		<h3 className="font-semibold text-lg">{student.user.name}</h3>
																		<div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
																			<span className="flex items-center gap-1">
																				<User className="h-3 w-3" />
																				Age {student.age}
																			</span>
																		</div>
																	</div>
																</div>

																<Separator />

																{/* Profile Details */}
																<div className="space-y-4 py-4">
																	{student.user?.profile?.bio && (
																		<div className="space-y-2">
																			<h4 className="text-sm font-medium text-muted-foreground">About</h4>
																			<p className="text-sm leading-relaxed">{student.user.profile.bio}</p>
																		</div>
																	)}

																	<div className="grid grid-cols-2 gap-4">
																		{student.enrolled_at && (
																			<Card>
																				<CardContent className="p-3 text-center">
																					<div className="flex items-center justify-center mb-1">
																						<CalendarDays className="h-4 w-4 text-muted-foreground" />
																					</div>
																					<div className="text-xs text-muted-foreground">Enrolled</div>
																					<div className="text-sm font-medium">{student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : 'Unknown'}</div>
																				</CardContent>
																			</Card>
																		)}

																		{student.completed_sessions_count !== undefined && (
																			<Card>
																				<CardContent className="p-3 text-center">
																					<div className="flex items-center justify-center mb-1">
																						<Clock className="h-4 w-4 text-muted-foreground" />
																					</div>
																					<div className="text-xs text-muted-foreground">Sessions</div>
																					<div className="text-sm font-medium">{student.completed_sessions_count}</div>
																				</CardContent>
																			</Card>
																		)}
																	</div>
																</div>

																{/* <Separator /> */}

																{/* Action Buttons */}
																{/* <div className="flex gap-2 pt-4">
																	<Button variant="outline" className="flex-1 bg-transparent">
																		Schedule Session
																	</Button>
																	<Button className="flex-1">View Progress</Button>
																</div> */}
															</DialogContent>
														</Dialog>
													</div>
												</TableCell>
											</TableRow>
										))}
										{students.length === 0 && (
											<TableRow>
												<TableCell colSpan={5} className="h-24 text-center">
													No students found.
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
