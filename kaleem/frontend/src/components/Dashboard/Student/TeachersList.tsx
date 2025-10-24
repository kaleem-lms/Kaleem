import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users } from "lucide-react"

interface TeachersListProps {
  teachers: {
    top_teachers_by_total_time: Array<{
      teacher_id: number
      teacher_name: string
      total_time: string
    }>
    total_teachers_count: number
  }
}

export function TeachersList({ teachers }: TeachersListProps) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-600" />
          Teachers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teachers.total_teachers_count === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No teachers data yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teachers.top_teachers_by_total_time.length > 0 ? (
              teachers.top_teachers_by_total_time.map((teacher) => (
                <div
                  key={teacher.teacher_id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {teacher.teacher_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{teacher.teacher_name}</p>
                      <p className="text-xs text-muted-foreground">{teacher.total_time}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Total teachers: {teachers.total_teachers_count}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
