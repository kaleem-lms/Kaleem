import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, FileText, UserPlus, Clock } from 'lucide-react'
import { Link } from '@tanstack/react-router'

const dashboardData = {
  upcoming_sessions: [
    { id: 1, student: "Ali Ahmed", date: "2025-04-01", time: "10:00 AM", status: "Scheduled" },
    { id: 2, student: "Sara Khaled", date: "2025-04-02", time: "11:30 AM", status: "Scheduled" },
  ],
  pending_reports: [{ session_id: 1, student: "Ali Ahmed", due_date: "2025-04-03" }],
  trial_requests: [{ id: 101, student: "Mohamed Hassan", request_date: "2025-03-29", status: "Pending" }],
  subscription: {
    plan: "Pro",
    expiry: "2025-06-01",
    remaining_sessions: 12,
  },
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Button>
              <CalendarDays className="mr-2 h-4 w-4" />
              Schedule Session
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Upcoming Sessions
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.upcoming_sessions.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Next: {dashboardData.upcoming_sessions[0]?.date || 'None'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Reports
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.pending_reports.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Due: {dashboardData.pending_reports[0]?.due_date || 'None'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Trial Requests
              </CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.trial_requests.length}
              </div>
              <p className="text-xs text-muted-foreground">Since last week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Remaining Sessions
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.subscription.remaining_sessions}
              </div>
              <p className="text-xs text-muted-foreground">
                Plan: {dashboardData.subscription.plan} (Expires:{' '}
                {dashboardData.subscription.expiry})
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>
                Your scheduled sessions for the next few days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.upcoming_sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between border-b pb-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.student}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.date} at {session.time}
                      </p>
                    </div>
                    <Badge>{session.status}</Badge>
                  </div>
                ))}
                <Button variant="outline" asChild className="w-full">
                  <Link to="/sessions">View All Sessions</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Pending Reports</CardTitle>
              <CardDescription>
                Reports that need to be completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.pending_reports.map((report) => (
                  <div
                    key={report.session_id}
                    className="flex items-center justify-between border-b pb-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {report.student}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Due: {report.due_date}
                      </p>
                    </div>
                    <Button size="sm">Complete</Button>
                  </div>
                ))}
                {dashboardData.pending_reports.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No pending reports
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Trial Requests</CardTitle>
              <CardDescription>
                New student trial session requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.trial_requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between border-b pb-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {request.student}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Requested: {request.request_date}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Decline
                      </Button>
                      <Button size="sm">Accept</Button>
                    </div>
                  </div>
                ))}
                {dashboardData.trial_requests.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No trial requests
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Your current plan and usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Plan</p>
                    <Badge variant="outline">
                      {dashboardData.subscription.plan}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Expiry</p>
                    <p className="text-sm text-muted-foreground">
                      {dashboardData.subscription.expiry}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Remaining Sessions</p>
                    <p className="text-sm text-muted-foreground">
                      {dashboardData.subscription.remaining_sessions}
                    </p>
                  </div>
                </div>
                <Button variant="outline" asChild className="w-full">
                  <Link to="/subscription">Manage Subscription</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
