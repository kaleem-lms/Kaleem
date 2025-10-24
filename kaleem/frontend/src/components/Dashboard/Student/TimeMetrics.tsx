import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar } from 'lucide-react';

interface TimeMetricsProps {
	overview: {
		total_time_spent_all_time: {
			hours: number;
			minutes: number;
			seconds: number;
			human_readable: string;
		};
		total_time_spent_current_month: {
			hours: number;
			minutes: number;
			seconds: number;
			human_readable: string;
		};
		average_session_length: {
			hours: number;
			minutes: number;
			seconds: number;
			human_readable: string;
		};
		current_streak_weeks: number;
	};
}

export function TimeMetrics({ overview }: TimeMetricsProps) {
	return (
		<div className="space-y-4">
			<Card className="border-border">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Clock className="h-4 w-4 text-blue-600" />
						Time Spent
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<p className="text-sm text-muted-foreground">All Time</p>
						<p className="text-2xl font-bold text-foreground">{overview.total_time_spent_all_time.human_readable}</p>
					</div>
					<div className="border-t border-border pt-4">
						<p className="text-sm text-muted-foreground">This Month</p>
						<p className="text-2xl font-bold text-foreground">{overview.total_time_spent_current_month.human_readable}</p>
					</div>
				</CardContent>
			</Card>

			<Card className="border-border">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Calendar className="h-4 w-4 text-green-600" />
						Streak
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">Current Streak</p>
					<p className="text-3xl font-bold text-foreground">
						{overview.current_streak_weeks}
						<span className="text-lg text-muted-foreground"> weeks</span>
					</p>
				</CardContent>
			</Card>

			<Card className="border-border">
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Avg Session Length</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-2xl font-bold text-foreground">{overview.average_session_length.human_readable}</p>
				</CardContent>
			</Card>
		</div>
	);
}
