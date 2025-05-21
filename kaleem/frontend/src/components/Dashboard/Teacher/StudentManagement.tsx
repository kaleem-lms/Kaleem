import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  Book,
  Calendar,
  ChevronDown,
  FileText,
  Film,
  Search,
  User,
  Users,
  Plus,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getTeacherStudents } from '@/api/axios'

// Types
interface Resource {
  id: number
  file: string
  category: string
  title: string
  description: string
  resource_type: string
  video_url: string
  created_at: string
}

interface Student {
  id: number
  name: string
  email: string
  avatar?: string
}

interface SessionReport {
  id: number
  student_id: number
  student_name: string
  date: string
  duration: number
  topics_covered: string
  progress: string
  homework: string
  attendance: 'present' | 'absent' | 'late'
}

// Mock data
const mockStudents: Student[] = [
  {
    id: 1,
    name: 'Ahmed Ali',
    email: 'ahmed@example.com',
    avatar: '/placeholder.svg?height=40&width=40',
  },
  {
    id: 2,
    name: 'Fatima Khan',
    email: 'fatima@example.com',
    avatar: '/placeholder.svg?height=40&width=40',
  },
  {
    id: 3,
    name: 'Mohammed Hassan',
    email: 'mohammed@example.com',
    avatar: '/placeholder.svg?height=40&width=40',
  },
  {
    id: 4,
    name: 'Aisha Malik',
    email: 'aisha@example.com',
    avatar: '/placeholder.svg?height=40&width=40',
  },
  {
    id: 5,
    name: 'Omar Farooq',
    email: 'omar@example.com',
    avatar: '/placeholder.svg?height=40&width=40',
  },
]

const mockSessionReports: SessionReport[] = [
  {
    id: 1,
    student_id: 1,
    student_name: 'Ahmed Ali',
    date: '2025-03-20T10:00:00Z',
    duration: 45,
    topics_covered: 'Surah Al-Fatiha, Tajweed rules',
    progress: 'Good progress on memorization',
    homework: 'Practice Surah Al-Fatiha with proper tajweed',
    attendance: 'present',
  },
  {
    id: 2,
    student_id: 2,
    student_name: 'Fatima Khan',
    date: '2025-03-19T11:00:00Z',
    duration: 30,
    topics_covered: 'Surah Al-Baqarah (verses 1-5)',
    progress: 'Needs more practice with pronunciation',
    homework: 'Review pronunciation of Arabic letters',
    attendance: 'present',
  },
  {
    id: 3,
    student_id: 3,
    student_name: 'Mohammed Hassan',
    date: '2025-03-18T09:00:00Z',
    duration: 60,
    topics_covered: 'Surah Al-Ikhlas, Surah Al-Falaq',
    progress: 'Excellent memorization skills',
    homework: 'Start memorizing Surah An-Nas',
    attendance: 'late',
  },
  {
    id: 4,
    student_id: 1,
    student_name: 'Ahmed Ali',
    date: '2025-03-17T10:00:00Z',
    duration: 45,
    topics_covered: 'Review of previous lessons',
    progress: 'Consistent improvement',
    homework: 'Continue practicing Surah Al-Fatiha',
    attendance: 'present',
  },
  {
    id: 5,
    student_id: 4,
    student_name: 'Aisha Malik',
    date: '2025-03-16T14:00:00Z',
    duration: 45,
    topics_covered: 'Introduction to Tajweed',
    progress: 'Good understanding of basic concepts',
    homework: 'Practice identifying Tajweed rules in Surah Al-Fatiha',
    attendance: 'absent',
  },
]

// Sample resources data from the provided JSON
const initialResources: Resource[] = [
  {
    id: 1,
    file: 'http://localhost:8000/media/resources/bg.jpg',
    category: 'Quran',
    title: 'Quran 1',
    description: 'asd',
    resource_type: 'document',
    video_url: '',
    created_at: '2025-03-20T23:06:44.812066Z',
  },
]

// Mock student-resource assignments
interface StudentResource {
  id: number
  student_id: number
  resource_id: number
  assigned_at: string
}

const mockStudentResources: StudentResource[] = [
{ id: 1, student_id: 1, resource_id: 1, assigned_at: '2025-03-19T10:00:00Z' },
]

export default function StudentManagement() {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [resources, setResources] = useState<Resource[]>(initialResources)
  const [studentResources, setStudentResources] =
    useState<StudentResource[]>(mockStudentResources)
  const [isAssigningResource, setIsAssigningResource] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sudents = await getTeacherStudents()
        setStudents(sudents)
      } catch (error) {
        console.error('Error fetching plans:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter students based on search query
  const filteredStudents = students.filter(
    (student) =>
      student.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Get reports for selected student
  const studentReports = selectedStudent
    ? mockSessionReports.filter(
        (report) => report.student_id === selectedStudent.id,
      )
    : []

  // Get resources assigned to selected student
  const assignedResources = selectedStudent
    ? (studentResources
        .filter((sr) => sr.student_id === selectedStudent.id)
        .map((sr) => resources.find((r) => r.id === sr.resource_id))
        .filter(Boolean) as Resource[])
    : []

  // Function to assign a resource to a student
  const assignResourceToStudent = (resourceId: number) => {
    if (!selectedStudent) return

    const newAssignment: StudentResource = {
      id: studentResources.length + 1,
      student_id: selectedStudent.id,
      resource_id: resourceId,
      assigned_at: new Date().toISOString(),
    }

    setStudentResources([...studentResources, newAssignment])
    setIsAssigningResource(false)
  }

  // Function to remove a resource assignment
  const removeResourceAssignment = (resourceId: number) => {
    if (!selectedStudent) return

    setStudentResources(
      studentResources.filter(
        (sr) =>
          !(
            sr.student_id === selectedStudent.id &&
            sr.resource_id === resourceId
          ),
      ),
  )
  }

  // Function to get resource icon based on type
  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="h-4 w-4" />
      case 'video':
        return <Film className="h-4 w-4" />
      default:
        return <Book className="h-4 w-4" />
    }
  }

  // Function to format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPP')
  }

  if (isLoading) {
    return <h1>Loading...</h1>
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Student Management
          </h1>
          <p className="text-muted-foreground">
            Manage resources and view session reports for your students.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Session
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add New Student
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Student List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Students
            </CardTitle>
            <CardDescription>Select a student to manage</CardDescription>
            <div className="mt-2">
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                icon={Search}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-1">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`flex items-center gap-3 rounded-md p-2 cursor-pointer transition-colors ${
                      selectedStudent?.id === student.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={student.avatar} alt={student.name} />
                      <AvatarFallback>
                        {student.user.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium leading-none truncate">
                        {student.user.name}
                      </p>
                      <p
                        className={`text-xs truncate ${selectedStudent?.id === student.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                      >
                        {student.user.email}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    No students found
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Student Details */}
        <div className="md:col-span-3">
          {selectedStudent ? (
            <Tabs defaultValue="resources" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={selectedStudent.user.profile.picture}
                      alt={selectedStudent.user.name}
                    />
                    <AvatarFallback>
                      {selectedStudent.user.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedStudent.user.name}
                    </h2>
                    <p className="text-muted-foreground">
                      {selectedStudent.user.email}
                    </p>
                  </div>
                </div>
                <TabsList>
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="reports">Session Reports</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="resources">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Assigned Resources</CardTitle>
                      <CardDescription>
                        Learning materials assigned to {selectedStudent.user.name}
                      </CardDescription>
                    </div>
                    <Dialog
                      open={isAssigningResource}
                      onOpenChange={setIsAssigningResource}
                    >
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Assign Resource
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Resource</DialogTitle>
                          <DialogDescription>
                            Select a resource to assign to{' '}
                            {selectedStudent.user.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <ScrollArea className="h-[300px]">
                            {resources.map((resource) => {
                              const isAssigned = studentResources.some(
                                (sr) =>
                                  sr.student_id === selectedStudent.id &&
                                  sr.resource_id === resource.id,
                              )

                              return (
                                <div
                                  key={resource.id}
                                  className="flex items-center justify-between p-3 hover:bg-muted rounded-md"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-md">
                                      {getResourceIcon(resource.resource_type)}
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {resource.title}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {resource.category}
                                      </p>
                                    </div>
                                  </div>
                                  {isAssigned ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-muted"
                                    >
                                      Assigned
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        assignResourceToStudent(resource.id)
                                      }
                                    >
                                      Assign
                                    </Button>
                                  )}
                                </div>
                              )
                            })}
                          </ScrollArea>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsAssigningResource(false)}
                          >
                            Cancel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {assignedResources.length > 0 ? (
                      <div className="grid gap-4">
                        {assignedResources.map((resource) => (
                          <div
                            key={resource.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-primary/10 p-3 rounded-md">
                                {getResourceIcon(resource.resource_type)}
                              </div>
                              <div>
                                <h4 className="font-medium">
                                  {resource.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">
                                    {resource.category}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="capitalize"
                                  >
                                    {resource.resource_type}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                  {resource.description ||
                                    'No description provided'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  removeResourceAssignment(resource.id)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Book className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">
                          No resources assigned
                        </h3>
                        <p className="text-muted-foreground mt-2">
                          Assign learning resources to help{' '}
                          {selectedStudent.user.name} with their studies.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() => setIsAssigningResource(true)}
                        >
                          Assign First Resource
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reports">
                <Card>
                  <CardHeader>
                    <CardTitle>Session Reports</CardTitle>
                    <CardDescription>
                      Recent learning sessions with {selectedStudent.user.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studentReports.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Topics Covered</TableHead>
                            <TableHead>Attendance</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentReports.map((report) => (
                            <TableRow key={report.id}>
                              <TableCell>{formatDate(report.date)}</TableCell>
                              <TableCell>{report.duration} min</TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {report.topics_covered}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    report.attendance === 'present'
                                      ? 'default'
                                      : report.attendance === 'late'
                                        ? 'secondary'
                                        : 'destructive'
                                  }
                                >
                                  {report.attendance}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <span>Actions</span>
                                      <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      Edit Report
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      Download PDF
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">
                          No session reports
                        </h3>
                        <p className="text-muted-foreground mt-2">
                          There are no recorded sessions with{' '}
                          {selectedStudent.user.name} yet.
                        </p>
                        <Button className="mt-4">Create Session Report</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {studentReports.length > 0 && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Latest Session Details</CardTitle>
                      <CardDescription>
                        {formatDate(studentReports[0].date)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-1">
                            Topics Covered
                          </h4>
                          <p>{studentReports[0].topics_covered}</p>
                        </div>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-1">Progress</h4>
                          <p>{studentReports[0].progress}</p>
                        </div>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-1">Homework</h4>
                          <p>{studentReports[0].homework}</p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full">
                        View Full Report
                      </Button>
                    </CardFooter>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <User className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">
                  No student selected
                </h3>
                <p className="text-muted-foreground mt-2">
                  Select a student from the list to view and manage their
                  resources and reports.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
