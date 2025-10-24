import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Teacher, TimeSlot } from "@/types"
import { formatTime, getDayName } from "@/lib/utils"

interface TeacherCardProps {
  teacher: Teacher
  onBookSlot: (teacher: Teacher, slot: TimeSlot) => void
}

export default function TeacherCard({ teacher, onBookSlot }: TeacherCardProps) {
  const freeSlots = teacher.time_slots.filter((slot) => slot.is_free)
  const initials = teacher.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-12 w-12">
              <AvatarImage src={teacher.user.profile.profile_image || "/placeholder.svg"} alt={teacher.user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{teacher.user.name}</h3>
              <p className="text-sm text-muted-foreground">{teacher.user.email}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Teacher Info */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Experience:</span>
            <span className="font-medium">{teacher.years_of_experience} year(s)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Phone:</span>
            <span className="font-medium">{teacher.phone_number}</span>
          </div>
        </div>

        {/* Available Slots */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Available Slots</h4>
          {freeSlots.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {freeSlots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{getDayName(slot.day_of_week)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onBookSlot(teacher, slot)}
                    className="ml-2 flex-shrink-0"
                  >
                    Book
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No available slots</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-2 pt-2">
          <Badge variant="secondary">{freeSlots.length} Available</Badge>
          <Badge variant="outline">{teacher.time_slots.filter((s) => !s.is_free).length} Booked</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
