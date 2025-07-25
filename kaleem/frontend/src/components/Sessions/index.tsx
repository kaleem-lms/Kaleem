import { ExternalLink, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getUserSessions } from '@/api/axios';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Session } from '@/types';
import { useAuth } from '../AuthContext';

const getStatusColor = (status: string) => {
	switch (status.toLowerCase()) {
		case 'scheduled':
			return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
		case 'completed':
		case 'joined':
			return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
		case 'cancelled':
		case 'missed':
			return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
		default:
			return '';
	}
};

export default function SessionsPage() {
	const [searchTerm, setSearchTerm] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [sessionsData, setSessionsData] = useState<Session[]>([]);
	const { user } = useAuth();

	useEffect(() => {
		getUserSessions().then((data) => {
			setSessionsData(data);
		});
	}, []);

	return (
		<div className="flex flex-col">
			<div className="flex-1 space-y-4 p-8 pt-6">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="font-bold text-3xl tracking-tight">Sessions</h2>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Manage Sessions</CardTitle>
						<CardDescription>View and manage all your teaching sessions</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col space-y-4">
							<div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
								<div className="relative flex-1">
									<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search by student name..."
										className="pl-8"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
									/>
								</div>
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger className="w-[180px]">
										<SelectValue placeholder="Filter by status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Statuses</SelectItem>
										<SelectItem value="scheduled">Scheduled</SelectItem>
										<SelectItem value="completed">Completed</SelectItem>
										<SelectItem value="cancelled">Cancelled</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{user?.role === 'T' ? 'Students' : 'Teacher'}</TableHead>
											<TableHead>Date</TableHead>
											<TableHead>Time</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{sessionsData.map((session) => (
											<TableRow key={session.id}>
												<TableCell className="font-medium">
													{user?.role === 'T' ? session.students_names.join(', ') : session.teacher_name}
												</TableCell>
												<TableCell>{session.date}</TableCell>
												<TableCell>
													{session.start_time} {'->'} {session.end_time}
												</TableCell>
												<TableCell>
													<Badge className={getStatusColor(session.status)} variant="outline">
														{session.status}
													</Badge>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														{session.status === 'Scheduled' && (
															<Button size="sm" variant="outline" asChild>
																<a href={session.zoom_meeting_link} target="_blank" rel="noopener noreferrer">
																	<ExternalLink className="mr-2 h-4 w-4" />
																	Join
																</a>
															</Button>
														)}
														<Dialog>
															<DialogTrigger asChild>
																<Button size="sm" variant="outline">
																	View
																</Button>
															</DialogTrigger>
															<DialogContent>
																<DialogHeader>
																	<DialogTitle>Session Details</DialogTitle>
																</DialogHeader>
																<div className="grid gap-4 py-4">
																	<div className="grid grid-cols-4 items-center gap-4">
																		<Label className="text-right font-medium">{user?.role === 'T' ? 'Students' : 'Teacher'}:</Label>
																		<span className="col-span-3">
																			{user?.role === 'T' ? session.students_names.join(', ') : session.teacher_name}
																		</span>
																	</div>
																	<div className="grid grid-cols-4 items-center gap-4">
																		<Label className="text-right font-medium">Date:</Label>
																		<span className="col-span-3">{session.date}</span>
																	</div>
																	<div className="grid grid-cols-4 items-center gap-4">
																		<Label className="text-right font-medium">Start Time:</Label>
																		<span className="col-span-3">{session.start_time}</span>
																	</div>
																	<div className="grid grid-cols-4 items-center gap-4">
																		<Label className="text-right font-medium">End Time:</Label>
																		<span className="col-span-3">{session.end_time}</span>
																	</div>
																	<div className="grid grid-cols-4 items-center gap-4">
																		<Label className="text-right font-medium">Status:</Label>
																		<span className="col-span-3">
																			<Badge className={getStatusColor(session.status)} variant="outline">
																				{session.status}
																			</Badge>
																		</span>
																	</div>
																	<div className="grid grid-cols-4 items-center gap-4">
																		<Label className="text-right font-medium">Meeting Link:</Label>
																		<a
																			href={session.zoom_meeting_link}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="col-span-3 flex items-center text-blue-500 hover:underline"
																		>
																			{session.zoom_meeting_link}
																			<ExternalLink className="ml-1 h-3 w-3" />
																		</a>
																	</div>
																</div>
															</DialogContent>
														</Dialog>
													</div>
												</TableCell>
											</TableRow>
										))}
										{sessionsData.length === 0 && (
											<TableRow>
												<TableCell colSpan={5} className="h-24 text-center">
													No sessions found.
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
