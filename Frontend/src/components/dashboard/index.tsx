import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '@/api/axios'
import { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Book, GraduationCap, MessageSquare, Package2 } from 'lucide-react'

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import Header from '../header'

export default function Dashboard() {
    const {
        data: user,
        isLoading,
        error,
    } = useQuery<User | null>({
        queryKey: ['user'],
        queryFn: getCurrentUser,
        refetchOnWindowFocus: false,
    })

    if (isLoading) {
        return <h1 className="text-4xl">Loading...</h1> // TODO: add loading page here
    }

    if (error) {
        return <h1 className="text-4xl">Error fetching user data.</h1> // TODO: add error page here
    }

    return (
        <>
            <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
                <div className="mx-auto grid w-full max-w-6xl gap-6">
                    <h1 className="text-3xl font-bold">
                        Welcome back, {user?.name || 'Student'}!
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Here's what you need to focus on today.
                    </p>
                </div>
                <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Current Courses</CardTitle>
                            <CardDescription>
                                Your enrolled courses
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                <li className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Book className="h-5 w-5 text-primary" />
                                        <span>Introduction to Programming</span>
                                    </div>
                                    <Progress value={75} className="w-[60px]" />
                                </li>
                                <li className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Book className="h-5 w-5 text-primary" />
                                        <span>Data Structures</span>
                                    </div>
                                    <Progress value={40} className="w-[60px]" />
                                </li>
                                <li className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Book className="h-5 w-5 text-primary" />
                                        <span>Web Development Basics</span>
                                    </div>
                                    <Progress value={90} className="w-[60px]" />
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Upcoming Deadlines</CardTitle>
                            <CardDescription>Tasks due soon</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                <li className="flex items-center justify-between">
                                    <span>Programming Assignment 2</span>
                                    <span className="text-sm text-muted-foreground">
                                        Due in 2 days
                                    </span>
                                </li>
                                <li className="flex items-center justify-between">
                                    <span>Data Structures Quiz</span>
                                    <span className="text-sm text-muted-foreground">
                                        Due in 5 days
                                    </span>
                                </li>
                                <li className="flex items-center justify-between">
                                    <span>Web Dev Project Submission</span>
                                    <span className="text-sm text-muted-foreground">
                                        Due in 1 week
                                    </span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Announcements</CardTitle>
                            <CardDescription>
                                Latest updates from your courses
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                <li>
                                    <h3 className="font-semibold">
                                        New Resource Available
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Additional reading materials for Data
                                        Structures have been uploaded.
                                    </p>
                                </li>
                                <li>
                                    <h3 className="font-semibold">
                                        Guest Lecture
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Join us for a special Web Development
                                        seminar next week.
                                    </p>
                                </li>
                                <li>
                                    <h3 className="font-semibold">
                                        Grading Update
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Programming Assignment 1 grades have
                                        been posted.
                                    </p>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
                <div className="mx-auto w-full max-w-6xl">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                            <CardDescription>
                                Frequently used tools and resources
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Button className="w-full">
                                    <Book className="mr-2 h-4 w-4" />
                                    Course Catalog
                                </Button>
                                <Button className="w-full">
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Discussion Forums
                                </Button>
                                <Button className="w-full">
                                    <Package2 className="mr-2 h-4 w-4" />
                                    Resource Library
                                </Button>
                                <Button className="w-full">
                                    <GraduationCap className="mr-2 h-4 w-4" />
                                    Academic Support
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </>
    )
}
