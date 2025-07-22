'use client';

import { FileIcon as FilePresentation, FileText, MoreHorizontal, Plus, Search, Upload, Video } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const resourcesData = {
	resources: [
		{
			id: 1,
			title: 'Math Basics',
			type: 'PDF',
			last_updated: '2025-03-20',
			assigned_students: [1, 2],
		},
		{
			id: 2,
			title: 'Science Experiment',
			type: 'Video',
			last_updated: '2025-03-25',
			assigned_students: [2],
		},
		{
			id: 3,
			title: 'Reading Comprehension',
			type: 'PDF',
			last_updated: '2025-03-22',
			assigned_students: [1, 3, 4],
		},
		{
			id: 4,
			title: 'Grammar Rules',
			type: 'Document',
			last_updated: '2025-03-18',
			assigned_students: [2, 5],
		},
		{
			id: 5,
			title: 'History Timeline',
			type: 'Presentation',
			last_updated: '2025-03-15',
			assigned_students: [1, 2, 3, 4, 5],
		},
	],
};

const studentsData = {
	students: [
		{
			id: 1,
			name: 'Ali Ahmed',
			age: 10,
			last_activity: '2025-03-28',
			performance: 'Good',
		},
		{
			id: 2,
			name: 'Sara Khaled',
			age: 12,
			last_activity: '2025-03-27',
			performance: 'Excellent',
		},
		{
			id: 3,
			name: 'Mohamed Hassan',
			age: 9,
			last_activity: '2025-03-26',
			performance: 'Average',
		},
		{
			id: 4,
			name: 'Fatima Ali',
			age: 11,
			last_activity: '2025-03-25',
			performance: 'Good',
		},
		{
			id: 5,
			name: 'Ahmed Mahmoud',
			age: 10,
			last_activity: '2025-03-24',
			performance: 'Excellent',
		},
	],
};

export default function ResourcesPage() {
	const [searchTerm, setSearchTerm] = useState('');
	const [typeFilter, setTypeFilter] = useState('all');

	const filteredResources = resourcesData.resources.filter((resource) => {
		const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesType = typeFilter === 'all' || resource.type.toLowerCase() === typeFilter.toLowerCase();
		return matchesSearch && matchesType;
	});

	const getResourceIcon = (type: string) => {
		switch (type.toLowerCase()) {
			case 'pdf':
				return <FileText className="h-4 w-4" />;
			case 'video':
				return <Video className="h-4 w-4" />;
			case 'presentation':
				return <FilePresentation className="h-4 w-4" />;
			default:
				return <FileText className="h-4 w-4" />;
		}
	};

	return (
		<div className="flex flex-col">
			<div className="flex-1 space-y-4 p-8 pt-6">
				<div className="flex items-center justify-between space-y-2">
					<h2 className="font-bold text-3xl tracking-tight">Resources</h2>
					<Dialog>
						<DialogTrigger asChild>
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								Add Resource
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-[425px]">
							<DialogHeader>
								<DialogTitle>Add New Resource</DialogTitle>
								<DialogDescription>Upload a new learning resource for your students.</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="title" className="text-right">
										Title
									</Label>
									<Input id="title" placeholder="Resource title" className="col-span-3" />
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="type" className="text-right">
										Type
									</Label>
									<Select>
										<SelectTrigger className="col-span-3">
											<SelectValue placeholder="Select type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="pdf">PDF</SelectItem>
											<SelectItem value="video">Video</SelectItem>
											<SelectItem value="document">Document</SelectItem>
											<SelectItem value="presentation">Presentation</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="file" className="text-right">
										File
									</Label>
									<div className="col-span-3">
										<div className="flex w-full items-center justify-center">
											<label
												htmlFor="dropzone-file"
												className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 hover:bg-muted"
											>
												<div className="flex flex-col items-center justify-center pt-5 pb-6">
													<Upload className="mb-3 h-8 w-8 text-muted-foreground" />
													<p className="mb-2 text-muted-foreground text-sm">
														<span className="font-semibold">Click to upload</span> or drag and drop
													</p>
													<p className="text-muted-foreground text-xs">PDF, DOC, PPT, MP4 (MAX. 100MB)</p>
												</div>
												<input id="dropzone-file" type="file" className="hidden" />
											</label>
										</div>
									</div>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="students" className="text-right">
										Assign To
									</Label>
									<Select>
										<SelectTrigger className="col-span-3">
											<SelectValue placeholder="Select students" />
										</SelectTrigger>
										<SelectContent>
											{studentsData.students.map((student) => (
												<SelectItem key={student.id} value={student.id.toString()}>
													{student.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<DialogFooter>
								<Button type="submit">Upload Resource</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
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
										<SelectItem value="pdf">PDF</SelectItem>
										<SelectItem value="video">Video</SelectItem>
										<SelectItem value="document">Document</SelectItem>
										<SelectItem value="presentation">Presentation</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Title</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Last Updated</TableHead>
											<TableHead>Assigned To</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredResources.map((resource) => (
											<TableRow key={resource.id}>
												<TableCell className="font-medium">
													<div className="flex items-center">
														{getResourceIcon(resource.type)}
														<span className="ml-2">{resource.title}</span>
													</div>
												</TableCell>
												<TableCell>{resource.type}</TableCell>
												<TableCell>{resource.last_updated}</TableCell>
												<TableCell>
													<Badge variant="outline">{resource.assigned_students.length} students</Badge>
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
															<DropdownMenuItem>View</DropdownMenuItem>
															<DropdownMenuItem>Edit</DropdownMenuItem>
															<DropdownMenuItem>Assign</DropdownMenuItem>
															<DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))}
										{filteredResources.length === 0 && (
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
		</div>
	);
}
