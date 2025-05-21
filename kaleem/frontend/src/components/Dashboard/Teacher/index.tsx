import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, FileText } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { getTeacherDashboard } from '@/api/axios'
import { TeacherDashboardData } from '@/types'

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData>({
    upcoming_sessions: {
      count: 0,
      next_session_timestamp: null,
    },
    pending_reports: [],
  })

  useEffect(() => {
    getTeacherDashboard().then((data) => {
      setDashboardData(data)
    })
  }, [])

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Upcoming Sessions
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.upcoming_sessions.count}
              </div>
              {dashboardData.upcoming_sessions.next_session_timestamp && (
                <p className="text-xs text-muted-foreground">
                  Next:{' '}
                  {formatTimestamp(
                    dashboardData.upcoming_sessions.next_session_timestamp,
                  )}
                </p>
              )}
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
        </div>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Pending Reports</CardTitle>
            <CardDescription>Reports that need to be completed</CardDescription>
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
    </div>
  )
}
