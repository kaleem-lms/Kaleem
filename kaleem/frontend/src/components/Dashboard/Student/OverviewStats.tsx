import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, TrendingUp, Zap } from "lucide-react"

interface OverviewStatsProps {
  overview: {
    total_sessions: number
    completed_sessions: number
    attendance_rate_percent: number
    engagement_score: number
    current_streak_weeks: number
    teachers_interacted_with: number
  }
}

export function OverviewStats({ overview }: OverviewStatsProps) {
  const stats = [
    {
      title: "Total Sessions",
      value: overview.total_sessions,
      icon: BookOpen,
      color: "bg-blue-500/10 text-blue-600",
    },
    {
      title: "Completed",
      value: overview.completed_sessions,
      icon: TrendingUp,
      color: "bg-green-500/10 text-green-600",
    },
    {
      title: "Attendance Rate",
      value: `${overview.attendance_rate_percent}%`,
      icon: Zap,
      color: "bg-amber-500/10 text-amber-600",
    },
    {
      title: "Teachers",
      value: overview.teachers_interacted_with,
      icon: Users,
      color: "bg-purple-500/10 text-purple-600",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
