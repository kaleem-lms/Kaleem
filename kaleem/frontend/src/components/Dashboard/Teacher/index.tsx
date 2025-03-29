"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, Users, FileText, ChevronDown, ChevronUp, BookOpen, Star, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getTeacherDashboard } from "@/api/axios"

// Define types for our data
interface Session {
  date: string
  start_time: string
  end_time: string
  students: string[]
  status: string
}

interface LastSession {
  date: string
  start_time: string
}

interface Student {
  student: string
  family: string | null
  taken_sessions_count: number
  last_session: LastSession | null
  current_resource: string | null
}

interface Report {
  student: string
  teacher: string
  session_slot: number
  created_at: string
  content: string
  rate: number
}

interface DashboardData {
  weekly_timetable: Session[]
  subscribed_students: Student[]
  students_reports: Report[]
}


export default function TeacherDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getTeacherDashboard()
        setDashboardData(data)
        setError(null)
      } catch (err) {
        setError("Failed to load dashboard data. Please try again later.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const toggleStudentExpand = (student: string) => {
    if (expandedStudent === student) {
      setExpandedStudent(null)
    } else {
      setExpandedStudent(student)
    }
  }

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(":")
      return `${hours}:${minutes}`
    } catch (e) {
      return timeString
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>
      case "completed":
        return (
          <Badge variant="success" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            Completed
          </Badge>
        )
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading dashboard data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <div className="flex flex-col p-6 min-h-screen bg-background">
      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Students</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Weekly Schedule
              </CardTitle>
              <CardDescription>View and manage your upcoming teaching sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.weekly_timetable.length > 0 ? (
                      dashboardData.weekly_timetable.map((session, index) => (
                        <TableRow key={index}>
                          <TableCell>{format(parseISO(session.date), "MMM dd, yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                  {session.students[0] ? getInitials(session.students[0]) : "?"}
                                </AvatarFallback>
                              </Avatar>
                              {session.students.join(", ")}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No scheduled sessions for this week
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Previous Week</Button>
              <Button variant="outline">Next Week</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Subscribed Students
              </CardTitle>
              <CardDescription>Manage your students and their learning progress</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border">
                <div className="space-y-4 p-4">
                  {dashboardData.subscribed_students.length > 0 ? (
                    dashboardData.subscribed_students.map((student, index) => (
                      <Card key={index} className="overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50"
                          onClick={() => toggleStudentExpand(student.student)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {getInitials(student.student)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-medium">{student.student}</h3>
                              <p className="text-sm text-muted-foreground">
                                {student.family ? `Family: ${student.family}` : "No family group"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-medium">Sessions</p>
                              <p className="text-sm text-muted-foreground">{student.taken_sessions_count}</p>
                            </div>
                            <Button variant="ghost" size="icon">
                              {expandedStudent === student.student ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {expandedStudent === student.student && (
                          <div className="p-4 pt-0 border-t border-border">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  Last Session
                                </h4>
                                {student.last_session ? (
                                  <div className="text-sm">
                                    <p>Date: {format(parseISO(student.last_session.date), "MMM dd, yyyy")}</p>
                                    <p>Time: {formatTime(student.last_session.start_time)}</p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No sessions yet</p>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                                  Current Resource
                                </h4>
                                {student.current_resource ? (
                                  <p className="text-sm">{student.current_resource}</p>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No resource assigned</p>
                                )}
                              </div>
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                              <Button variant="outline" size="sm">
                                Add Report
                              </Button>
                              <Button size="sm">Update Resource</Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">No students subscribed yet</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Student Reports
              </CardTitle>
              <CardDescription>Track student progress and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border">
                {dashboardData.students_reports.length > 0 ? (
                  <div className="space-y-4 p-4">
                    {dashboardData.students_reports.map((report, index) => (
                      <Card key={index} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                  {getInitials(report.student)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-medium">{report.student}</h3>
                                <p className="text-xs text-muted-foreground">
                                  Session: {report.session_slot} • {format(parseISO(report.created_at), "MMM dd, yyyy")}
                                </p>
                              </div>
                            </div>
                            <div>{renderStarRating(report.rate)}</div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm border-l-2 border-primary pl-3 py-1">{report.content}</div>
                        </CardContent>
                        <CardFooter className="pt-0 flex justify-end">
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center p-6">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Reports Available</h3>
                      <p className="text-muted-foreground mb-4">You haven't created any student reports yet</p>
                      <Button>Create New Report</Button>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button>Create New Report</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

