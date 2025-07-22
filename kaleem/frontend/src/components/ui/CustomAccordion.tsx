import { ChevronDown } from 'lucide-react';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface AccordionItemProps {
	title: React.ReactNode;
	children: React.ReactNode;
	icon?: React.ReactNode;
	defaultOpen?: boolean;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({ title, children, icon, defaultOpen = false }) => {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const id = React.useId();
	const headingId = `${id}-heading`;
	const contentId = `${id}-content`;

	return (
		<div className="border-b">
			<h3>
				<button
					type="button"
					aria-expanded={isOpen}
					className={cn(
						'flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:text-primary',
						isOpen && 'text-primary',
					)}
					onClick={() => setIsOpen(!isOpen)}
					aria-controls={contentId}
					id={headingId}
				>
					<div className="flex items-center gap-2">
						{icon}
						<span>{title}</span>
					</div>
					<ChevronDown
						className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
						aria-hidden="true"
					/>
				</button>
			</h3>
			<div
				id={contentId}
				role="region"
				aria-labelledby={headingId}
				className={cn('overflow-hidden transition-all', isOpen ? 'max-h-[1000px] pb-4 opacity-100' : 'max-h-0 opacity-0')}
			>
				{children}
			</div>
		</div>
	);
};

interface AccordionProps {
	children: React.ReactNode;
	className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({ children, className }) => {
	return <div className={cn('divide-y rounded-md border', className)}>{children}</div>;
};
