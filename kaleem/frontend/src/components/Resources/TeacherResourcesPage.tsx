import {
	Calendar,
	ExternalLink,
	FileIcon as FilePresentation,
	FileText,
	MoreHorizontal,
	Search,
	Users,
	Video,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Resource, Student } from '@/types';
import { assignResource, getTeacherResources, getTeacherStudents } from '@/api/axios';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';

const getResourceIcon = (type: string) => {
	switch (type.toLowerCase()) {
		case 'document':
			return <FileText className="h-4 w-4" />;
		case 'video':
			return <Video className="h-4 w-4" />;
		case 'file':
			return <FilePresentation className="h-4 w-4" />;
		default:
			return <FileText className="h-4 w-4" />;
	}
};

export default function TeacherResourcesPage() {
	const [searchTerm, setSearchTerm] = useState('');
	const [typeFilter, setTypeFilter] = useState('all');
	const [resources, setResources] = useState<Resource[]>([]);
	const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);
	const [viewDialogOpen, setViewDialogOpen] = useState(false);
	const [assignDialogOpen, setAssignDialogOpen] = useState(false);
	const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
	const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
	const [assignLoading, setAssignLoading] = useState(false);
	const [assignError, setAssignError] = useState<string | null>(null);

	useEffect(() => {
		getTeacherResources().then((data) => {
			setResources(data);
		});
	}, []);

	useEffect(() => {
		getTeacherStudents().then((data) => {
			setTeacherStudents(data);
		});
	}, []);

	const handleViewResource = (resource: Resource) => {
		setSelectedResource(resource);
		setViewDialogOpen(true);
	};

	const handleAssignResource = (resource: Resource) => {
		setSelectedResource(resource);
		setSelectedStudents(resource.students_assigned.map((student) => student.id));
		setAssignDialogOpen(true);
	};

	const handleStudentToggle = (studentId: number) => {
		setSelectedStudents((prev) =>
			prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
		);
	};

	const handleAssignSubmit = async () => {
		if (!selectedResource) {
			setAssignError('No resource selected.');
			return;
		}

		setAssignLoading(true);
		setAssignError(null);

		await assignResource({ resource_id: selectedResource.id, student_ids: selectedStudents });
		setAssignDialogOpen(false);
		setSelectedResource(null);
		setSelectedStudents([]);
		setAssignLoading(false);
	};

	return (
		<div className="flex flex-col">
			<div className="flex-1 space-y-4 p-8 pt-6">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="font-bold text-3xl tracking-tight">Resources</h2>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Learning Resources</CardTitle>
						<CardDescription>Manage and assign learning materials to your students</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col space-y-4">
							<div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
								<div className="relative flex-1">
									<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search resources..."
										className="pl-8"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
									/>
								</div>
								<Select value={typeFilter} onValueChange={setTypeFilter}>
									<SelectTrigger className="w-[180px]">
										<SelectValue placeholder="Filter by type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Types</SelectItem>
										<SelectItem value="pdf">File</SelectItem>
										<SelectItem value="document">Document</SelectItem>
										<SelectItem value="video">Video</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Title</TableHead>
											<TableHead>Category</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Assigned To</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{resources.map((resource) => (
											<TableRow key={resource.id}>
												<TableCell className="font-medium">
													<div className="flex items-center">
														{getResourceIcon(resource.resource_type)}
														<span className="ml-2">{resource.title}</span>
													</div>
												</TableCell>
												<TableCell>{resource.category}</TableCell>
												<TableCell>{resource.resource_type}</TableCell>
												<TableCell>
													<Badge variant="outline">{resource.students_assigned.length} students</Badge>
												</TableCell>
												<TableCell className="text-right">
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button variant="ghost" size="sm">
																<MoreHorizontal className="h-4 w-4" />
																<span className="sr-only">Actions</span>
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem onClick={() => handleViewResource(resource)}>View</DropdownMenuItem>
															<DropdownMenuItem onClick={() => handleAssignResource(resource)}>Assign</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))}
										{resources.length === 0 && (
											<TableRow>
												<TableCell colSpan={5} className="h-24 text-center">
													No resources found.
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

			{/* View Resource Dialog */}
			<Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{selectedResource && getResourceIcon(selectedResource.resource_type)}
							{selectedResource?.title}
						</DialogTitle>
						<DialogDescription>Resource details and information</DialogDescription>
					</DialogHeader>
					{selectedResource && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-sm font-medium">Type</Label>
									<p className="text-sm text-muted-foreground mt-1">
										<Badge variant="secondary">{selectedResource.resource_type}</Badge>
									</p>
								</div>
								<div>
									<Label className="text-sm font-medium">Category</Label>
									<p className="text-sm text-muted-foreground mt-1">{selectedResource.category}</p>
								</div>
							</div>

							<div>
								<Label className="text-sm font-medium">Description</Label>
								<p className="text-sm text-muted-foreground mt-1">{selectedResource.description}</p>
							</div>

							<div>
								<Label className="text-sm font-medium flex items-center gap-2">
									<Users className="h-4 w-4" />
									Assigned Students ({selectedResource.students_assigned.length})
								</Label>
								<div className="mt-3">
									{selectedResource.students_assigned.length > 0 ? (
										<div className="space-y-3">
											{selectedResource.students_assigned.map((student) => {
												return (
													<div key={student.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
														<div className="flex-shrink-0">
															<div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
																<span className="text-sm font-medium text-primary">{student.name.charAt(0).toUpperCase()}</span>
															</div>
														</div>
														<div className="flex-1 min-w-0">
															<p className="text-sm font-medium text-foreground truncate">{student.name}</p>
															<p className="text-xs text-muted-foreground truncate">{student.email}</p>
															<div className="flex items-center gap-2 mt-1">
																<Badge variant="outline" className="text-xs">
																	Student ID: {student.id}
																</Badge>
																<Badge variant="secondary" className="text-xs">
																	Enrolled: {new Date(student.enrolled_at).toLocaleDateString()}
																</Badge>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									) : (
										<div className="flex items-center justify-center p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg">
											<div className="text-center">
												<Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
												<p className="text-sm text-muted-foreground">No students assigned</p>
												<p className="text-xs text-muted-foreground/75 mt-1">
													Use the "Assign" action to assign this resource to students
												</p>
											</div>
										</div>
									)}
								</div>
							</div>

							<div>
								<Label className="text-sm font-medium flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									Created
								</Label>
								<p className="text-sm text-muted-foreground mt-1">
									{new Date(selectedResource.created_at).toLocaleDateString()}
								</p>
							</div>

							{selectedResource.file && (
								<div>
									<Label className="text-sm font-medium">File</Label>
									<div className="mt-2">
										<Button variant="outline" size="sm" asChild>
											<a href={selectedResource.file} target="_blank" rel="noopener noreferrer">
												<ExternalLink className="h-4 w-4 mr-2" />
												Open File
											</a>
										</Button>
									</div>
								</div>
							)}

							{selectedResource.video_url && (
								<div>
									<Label className="text-sm font-medium">Video URL</Label>
									<div className="mt-2">
										<Button variant="outline" size="sm" asChild>
											<a href={selectedResource.video_url} target="_blank" rel="noopener noreferrer">
												<ExternalLink className="h-4 w-4 mr-2" />
												Watch Video
											</a>
										</Button>
									</div>
								</div>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Assign Resource Dialog */}
			<Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Assign Resource</DialogTitle>
						<DialogDescription>Select students to assign "{selectedResource?.title}" to</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label className="text-sm font-medium">Students</Label>
							<ScrollArea className="h-64 mt-2 border rounded-md p-4">
								<div className="space-y-3">
									{teacherStudents.filter((student) => !selectedStudents.includes(student.id)).map((student) => (
										<div key={student.id} className="flex items-center space-x-2">
											<Checkbox
												id={`student-${student.id}`}
												checked={selectedStudents.includes(student.id)}
												onCheckedChange={() => handleStudentToggle(student.id)}
											/>
											<Label htmlFor={`student-${student.id}`} className="text-sm font-normal cursor-pointer flex-1">
												<div>
													<p className="font-medium">{student.user.name}</p>
													<p className="text-xs text-muted-foreground">{student.user.email}</p>
												</div>
											</Label>
										</div>
									))}
								</div>
							</ScrollArea>
						</div>
						<div className="text-sm text-muted-foreground">
							{selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
						</div>
					</div>
					{assignError && <p className="text-sm text-red-500">{assignError}</p>}
					<DialogFooter>
						<Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleAssignSubmit} disabled={assignLoading}>
							{assignLoading ? 'Assigning...' : 'Assign Resource'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
