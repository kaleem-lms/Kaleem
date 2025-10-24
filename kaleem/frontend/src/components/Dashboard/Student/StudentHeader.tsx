import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface StudentHeaderProps {
  student: {
    student_id: number
    student_name: string
    generated_at: string
  }
}

export function StudentHeader({ student }: StudentHeaderProps) {
  const initials = student.student_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back, {student.student_name}</h1>
          <p className="text-sm text-muted-foreground">Student ID: {student.student_id}</p>
        </div>
      </div>
    </div>
  )
}
