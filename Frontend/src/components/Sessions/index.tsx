import React, { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { getUserSessions } from '@/api/axios'
import { LoadingScreen } from '../LoadingScreen'
import { Session } from '@/types'

export function getWeekOptions() {
  const options = []
  const today = new Date()
  for (let i = -2; i <= 2; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i * 7)
    const weekStart = new Date(date.setDate(date.getDate() - date.getDay()))
    const weekEnd = new Date(date.setDate(date.getDate() - date.getDay() + 6))
    options.push({
      value: weekStart.toISOString().split('T')[0], // Week start date
      label: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
    })
  }
  return options
}

export default function SessionsPage() {
  const weekOptions = getWeekOptions()
  const [isLoading, setIsLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[2]?.value || '') // Default to current week
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([])

  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await getUserSessions()
        setSessions(response)
        setFilteredSessions(response) // Initially show all sessions
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSessions()
  }, [])

  const handleWeekChange = (value: string) => {
    setSelectedWeek(value)

    // Filter sessions based on the selected week
    const weekStart = new Date(value) // Selected week's start date
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // End of the selected week

    const filtered = sessions.filter((session) => {
      const sessionDate = new Date(session.date)
      return sessionDate >= weekStart && sessionDate <= weekEnd
    })

    setFilteredSessions(filtered)
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Quran Learning Sessions</h1>
      <div className="mb-6">
        <Select onValueChange={handleWeekChange} value={selectedWeek}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a week" />
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Teacher</TableHead>
            <TableHead>Student(s)</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSessions.map((session: Session) => (
            <TableRow key={session.id}>
              <TableCell>{new Date(session.date).toLocaleDateString()}</TableCell>
              <TableCell>
                {`${session.start_time} - ${session.end_time}`}
              </TableCell>
              <TableCell>{session.teacher_name}</TableCell>
              <TableCell>
                {session.students_names.join(', ')}
              </TableCell>
              <TableCell>
                <Button
                  disabled={new Date(`${session.date}T${session.start_time}`) > new Date()}
                  onClick={() => window.open(session.zoom_meeting_link, '_blank')}
                >
                  {new Date(`${session.date}T${session.start_time}`) > new Date()
                    ? 'Not Started'
                    : 'Join'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
