'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Search, Plus, User } from 'lucide-react'

const studentsData = {
  students: [
    { id: 1, name: "Ali Ahmed", age: 10, last_activity: "2025-03-28", performance: "Good" },
    { id: 2, name: "Sara Khaled", age: 12, last_activity: "2025-03-27", performance: "Excellent" },
    { id: 3, name: "Mohamed Hassan", age: 9, last_activity: "2025-03-26", performance: "Average" },
    { id: 4, name: "Fatima Ali", age: 11, last_activity: "2025-03-25", performance: "Good" },
    { id: 5, name: "Ahmed Mahmoud", age: 10, last_activity: "2025-03-24", performance: "Excellent" },
  ],
}

export default function StudentsPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredStudents = studentsData.students.filter((student) =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getPerformanceBadge = (performance: string) => {
    switch (performance.toLowerCase()) {
      case 'excellent':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
      case 'good':
        return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
      case 'average':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
      default:
        return ''
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Students</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>
                  Add a new student to your roster. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Student name"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="age" className="text-right">
                    Age
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="Student age"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Parent/Guardian email"
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Add Student</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Students</CardTitle>
            <CardDescription>View and manage all your students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.name}
                        </TableCell>
                        <TableCell>{student.age}</TableCell>
                        <TableCell>{student.last_activity}</TableCell>
                        <TableCell>
                          <Badge
                            className={getPerformanceBadge(student.performance)}
                            variant="outline"
                          >
                            {student.performance}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Student Profile</DialogTitle>
                                </DialogHeader>
                                <div className="flex flex-col items-center py-4">
                                  <div className="mb-4 rounded-full bg-muted p-6">
                                    <User className="h-12 w-12" />
                                  </div>
                                  <h3 className="text-xl font-bold">
                                    {student.name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    Age: {student.age}
                                  </p>
                                </div>
                                <div className="grid gap-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right font-medium">
                                      Last Activity:
                                    </Label>
                                    <span className="col-span-3">
                                      {student.last_activity}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right font-medium">
                                      Performance:
                                    </Label>
                                    <span className="col-span-3">
                                      <Badge
                                        className={getPerformanceBadge(
                                          student.performance,
                                        )}
                                        variant="outline"
                                      >
                                        {student.performance}
                                      </Badge>
                                    </span>
                                  </div>
                                </div>
                                <DialogFooter className="flex justify-between">
                                  <Button variant="outline">
                                    Schedule Session
                                  </Button>
                                  <Button>View Progress</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No students found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
