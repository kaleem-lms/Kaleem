import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStudentReports } from '@/api/axios';
import { useAuth } from '../AuthContext';

interface Report {
	id: number;
	teacher: {
		id: number;
		phone_number: string;
		hire_date: string | null;
		years_of_experience: number;
		user: {
			id: number;
			email: string;
			name: string;
			gender: string;
			profile: {
				bio: string;
				profile_image: string;
			};
			role: string;
			url: string;
		};
	};
	student: number;
	session_slot: number;
	created_at: string;
	content: Array<{
		key: string;
		value: string;
	}>;
	rate: number;
}

function StarRating({ rating }: { rating: number }) {
	return (
		<div className="flex items-center gap-1">
			{[...Array(5)].map((_, i) => (
				<Star key={i} size={16} className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'} />
			))}
			<span className="ml-2 text-sm font-medium text-muted-foreground">({rating}/5)</span>
		</div>
	);
}

function ReportCard({ report }: { report: Report }) {
	const formattedDate = new Date(report.created_at).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	const initials = report.teacher.user.name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase();

	return (
		<Card className="overflow-hidden hover:shadow-lg transition-shadow">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-4 flex-1">
						<Avatar className="h-12 w-12">
							<AvatarImage
								src={report.teacher.user.profile.profile_image || '/placeholder.svg'}
								alt={report.teacher.user.name}
							/>
							<AvatarFallback>{initials}</AvatarFallback>
						</Avatar>
						<div className="flex-1">
							<CardTitle className="text-lg">{report.teacher.user.name}</CardTitle>
							<CardDescription className="text-sm">
								{report.teacher.years_of_experience} year{report.teacher.years_of_experience !== 1 ? 's' : ''} of experience
							</CardDescription>
						</div>
					</div>
					<Badge variant="outline" className="ml-2">
						Session #{report.session_slot}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Rating */}
				<div className="space-y-2">
					<p className="text-sm font-medium text-foreground">Session Rating</p>
					<StarRating rating={report.rate} />
				</div>

				{/* Session Date */}
				<div className="space-y-2">
					<p className="text-sm font-medium text-foreground">Date & Time</p>
					<p className="text-sm text-muted-foreground">{formattedDate}</p>
				</div>

				{/* Teacher Contact */}
				<div className="space-y-2">
					<p className="text-sm font-medium text-foreground">Teacher Contact</p>
					<div className="space-y-1 text-sm text-muted-foreground">
						<p>📧 {report.teacher.user.email}</p>
						<p>📱 {report.teacher.phone_number}</p>
					</div>
				</div>

				{/* Session Notes */}
				{report.content.length > 0 && (
					<div className="space-y-2 pt-2 border-t">
						<p className="text-sm font-medium text-foreground">Session Notes</p>
						<div className="space-y-2">
							{report.content.map((item, idx) => (
								<div key={idx} className="bg-muted p-2 rounded text-sm">
									<span className="font-medium text-foreground">{item.key}:</span>{' '}
									<span className="text-muted-foreground">{item.value}</span>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default function ReportsPage() {
	const { user } = useAuth();
	const [reports, setReports] = useState<Report[]>([]);

	useEffect(() => {
		getStudentReports(user.id).then((data) => setReports(data));
	}, [user?.id]);

	if (!reports) {
		return <div>Loading...</div>;
	}

	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-foreground mb-2">My Learning Reports</h1>
					<p className="text-muted-foreground">View your session history and feedback from your teachers</p>
				</div>

				{/* Reports Grid */}
				{reports.length > 0 ? (
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
						{reports.map((report) => (
							<ReportCard key={report.id} report={report} />
						))}
					</div>
				) : (
					<Card className="text-center py-12">
						<CardContent>
							<p className="text-muted-foreground mb-2">No reports yet</p>
							<p className="text-sm text-muted-foreground">Your session reports will appear here after your first lesson</p>
						</CardContent>
					</Card>
				)}
			</div>
		</main>
	);
}
