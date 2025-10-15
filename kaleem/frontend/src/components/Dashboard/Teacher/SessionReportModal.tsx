import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { createSessionReport } from '@/api/axios';
import { StarRating } from '@/components/StarRating';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ContentItem, SessionReportData, TeacherDashboardSessionReport } from '@/types';


type SessionReportModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCompleted: (data: SessionReportData) => void;
	data: TeacherDashboardSessionReport;
};


export function SessionReportModal({ open, onOpenChange, data, onCompleted }: SessionReportModalProps) {
	const { toast } = useToast();

	const [formData, setFormData] = useState<SessionReportData>({
		content: [{ key: '', value: '' }],
		rate: 0,
	});

	const handleContentChange = (index: number, field: keyof ContentItem, value: string) => {
		const newContent = [...formData.content];
		newContent[index] = { ...newContent[index], [field]: value };
		setFormData({ ...formData, content: newContent });
	};

	const addContentItem = () => {
		setFormData({
			...formData,
			content: [...formData.content, { key: '', value: '' }],
		});
	};

	const removeContentItem = (index: number) => {
		if (formData.content.length > 1) {
			const newContent = formData.content.filter((_, i) => i !== index);
			setFormData({ ...formData, content: newContent });
		}
	};

	const handleSubmit = () => {
		// Validate required fields
		if (!formData.rate) {
			toast({
				title: 'Validation Error',
				description: 'Please fill in all required fields',
				variant: 'destructive',
			});
			return;
		}

		createSessionReport({
			...formData,
			content: formData.content.filter(item => item.key !== '' && item.value !== ''),
			session_slot: data.session_id,
			student: data.student_id
	}).then((data) => {
			toast({ title: 'Success', description: 'Session report created successfully' });
			onCompleted(data)
		}).catch(()=>{
			toast({ title: 'Failed', description: 'Failed to create report',variant: "destructive" });
		});

		// Reset form and close modal
		setFormData({
			content: [{ key: '', value: '' }],
			rate: 0,
			student: 0,
			session_slot: 0,
		});
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create Session Report</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{/* Session Details */}
					<Card>
						<CardHeader>
							<Button
								type="button"
								variant="outline"
								onClick={addContentItem}
								className="flex items-center gap-2 bg-transparent"
							>
								<Plus className="h-4 w-4" />
								Add Item
							</Button>
						</CardHeader>
						<CardContent className="space-y-4">
							{formData.content.map((item, index) => (
								<div key={index} className="grid grid-cols-12 gap-3 items-center">
									<div className="col-span-4">
										<Label htmlFor={`key-${index}`}>Key/Topic</Label>
										<Input
											id={`key-${index}`}
											value={item.key}
											onChange={(e) => handleContentChange(index, 'key', e.target.value)}
											placeholder="e.g., Surah Al-Fatiha"
										/>
									</div>

									<div className="col-span-7">
										<Label htmlFor={`value-${index}`}>Notes/Details</Label>
										<Textarea
											id={`value-${index}`}
											value={item.value}
											onChange={(e) => handleContentChange(index, 'value', e.target.value)}
											placeholder="Session notes and observations"
										/>
									</div>

									<div className="col-span-1">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => removeContentItem(index)}
											disabled={formData.content.length === 1}
											className="h-10 w-10 p-0"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
							<div>
								<Label htmlFor="rate">Session Rating</Label>
								<div className="mt-2">
									<StarRating value={formData.rate} onChange={(value) => setFormData({ ...formData, rate: value })} max={5} />
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSubmit}>Create Report</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
