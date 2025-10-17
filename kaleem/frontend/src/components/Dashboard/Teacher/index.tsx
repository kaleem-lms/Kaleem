import { CalendarDays, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTeacherDashboard } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTimestamp } from '@/lib/utils';
import type { SessionReportData, TeacherDashboardData, TeacherDashboardSessionReport } from '@/types';
import { SessionReportModal } from './SessionReportModal';

export default function TeacherDashboardPage() {
	const [dashboardData, setDashboardData] = useState<TeacherDashboardData>({
		upcoming_sessions: {
			count: 0,
			next_session_timestamp: null,
		},
		pending_reports: [],
	});

	const [isReportModalOpen, setIsReportModalOpen] = useState(false);
	const [selectedReport, setSelectedReport] = useState<TeacherDashboardSessionReport>({
		due_date: "",
		session_id: 0,
		student: "",
		student_id: 0,
	});

	useEffect(() => {
		getTeacherDashboard().then((data) => {
			setDashboardData(data);
		});
	}, []);

	const handleReportCompleted = (data: SessionReportData) => {
		console.log(data);
		setDashboardData({
			...dashboardData,
			pending_reports: dashboardData.pending_reports.filter(report => !(report.session_id === data.session_slot && report.student_id === data.student))
		})
    // setReports(prev => prev.filter(report => report.id !== id));
  };

	return (
		<div className="flex flex-col">
			<div className="flex-1 space-y-4 p-8 pt-6">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="font-bold text-3xl tracking-tight">Dashboard</h2>
				</div>

				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Upcoming Sessions</CardTitle>
							<CalendarDays className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{dashboardData.upcoming_sessions.count}</div>
							{dashboardData.upcoming_sessions.next_session_timestamp && (
								<p className="text-muted-foreground text-xs">
									Next: {formatTimestamp(dashboardData.upcoming_sessions.next_session_timestamp)}
								</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Pending Reports</CardTitle>
							<FileText className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{dashboardData.pending_reports.length}</div>
							<p className="text-muted-foreground text-xs">Due: {dashboardData.pending_reports[0]?.due_date || 'None'}</p>
						</CardContent>
					</Card>
				</div>

				<Card className="col-span-3">
					<CardHeader>
						<CardTitle>Pending Reports</CardTitle>
						<CardDescription>Reports that need to be completed</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{dashboardData.pending_reports.map((report) => (
								<div key={report.session_id} className="flex items-center justify-between border-b pb-4">
									<div className="space-y-1">
										<p className="font-medium text-sm leading-none">{report.student}</p>
										<p className="text-muted-foreground text-sm">Due: {report.due_date}</p>
									</div>
									<Button
										size="sm"
										onClick={() => {
											setSelectedReport(report);
											setIsReportModalOpen(true);
										}}
									>
										Complete
									</Button>
								</div>
							))}
							{dashboardData.pending_reports.length === 0 && (
								<p className="text-muted-foreground text-sm">No pending reports</p>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
			<SessionReportModal open={isReportModalOpen} onOpenChange={setIsReportModalOpen} data={selectedReport} onCompleted={handleReportCompleted} />
		</div>
	);
}
