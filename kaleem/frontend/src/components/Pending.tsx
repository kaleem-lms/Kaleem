import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export type PendingType = 'spinner' | 'skeleton' | 'dots' | 'pulse';
export type PendingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface PendingProps {
	type?: PendingType;
	size?: PendingSize;
	message?: string | ReactNode;
	fullPage?: boolean;
	className?: string;
	children?: ReactNode;
	delay?: number; // Delay in ms before showing the loader
	minHeight?: string;
	transparent?: boolean;
}

export function Pending({
	type = 'spinner',
	size = 'md',
	message,
	fullPage = false,
	className = '',
	children,
	minHeight,
	transparent = false,
}: PendingProps) {
	const { t } = useTranslation();

	// Size mappings
	const sizeClasses: Record<PendingSize, string> = {
		xs: 'h-3 w-3',
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8',
		xl: 'h-12 w-12',
	};

	const textSizeClasses: Record<PendingSize, string> = {
		xs: 'text-xs',
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg',
		xl: 'text-xl',
	};

	// Container classes based on whether it's full page or inline
	const containerClasses = cn(
		'flex flex-col items-center justify-center',
		fullPage ? 'min-h-[80vh] w-full' : 'p-4',
		transparent ? 'bg-transparent' : 'bg-background',
		className,
	);

	// Default loading message
	const defaultMessage = t('Loading...');
	const displayMessage = message || (fullPage ? defaultMessage : undefined);

	// Render different loader types
	const renderLoader = () => {
		switch (type) {
			case 'spinner':
				return (
					<div className="flex flex-col items-center gap-3">
						<Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
						{displayMessage && <p className={cn('text-muted-foreground', textSizeClasses[size])}>{displayMessage}</p>}
					</div>
				);

			case 'skeleton':
				return (
					<div className="w-full space-y-4">
						{children || (
							<>
								<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
								<div className="h-4 w-full animate-pulse rounded bg-muted" />
								<div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
								{displayMessage && (
									<p className={cn('mt-4 text-center text-muted-foreground', textSizeClasses[size])}>{displayMessage}</p>
								)}
							</>
						)}
					</div>
				);

			case 'dots':
				return (
					<div className="flex flex-col items-center gap-3">
						<div className="flex space-x-2">
							<div
								className={cn('animate-bounce rounded-full bg-primary', sizeClasses[size])}
								style={{ animationDelay: '0ms' }}
							/>
							<div
								className={cn('animate-bounce rounded-full bg-primary', sizeClasses[size])}
								style={{ animationDelay: '150ms' }}
							/>
							<div
								className={cn('animate-bounce rounded-full bg-primary', sizeClasses[size])}
								style={{ animationDelay: '300ms' }}
							/>
						</div>
						{displayMessage && <p className={cn('text-muted-foreground', textSizeClasses[size])}>{displayMessage}</p>}
					</div>
				);

			case 'pulse':
				return (
					<div className="flex flex-col items-center gap-3">
						<div className={cn('animate-pulse rounded-full bg-primary', sizeClasses[size])} />
						{displayMessage && <p className={cn('text-muted-foreground', textSizeClasses[size])}>{displayMessage}</p>}
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<div
			className={containerClasses}
			style={{ minHeight: minHeight || (fullPage ? '80vh' : 'auto') }}
			role="status"
			aria-live="polite"
		>
			{renderLoader()}
			<span className="sr-only">{t('Loading content, please wait')}</span>
		</div>
	);
}

// Specialized components for common use cases
export function FullPageLoading({ message, type = 'spinner', size = 'lg' }: Omit<PendingProps, 'fullPage'>) {
	return <Pending fullPage type={type} size={size} message={message} />;
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
	return (
		<tr className="animate-pulse">
			{Array(cols)
				.fill(0)
				.map((_, i) => (
					<td key={i} className="p-4">
						<div className="h-4 w-full rounded bg-muted" />
					</td>
				))}
		</tr>
	);
}

export function CardSkeleton() {
	return (
		<div className="animate-pulse rounded-lg border p-4">
			<div className="mb-4 h-4 w-3/4 rounded bg-muted" />
			<div className="space-y-2">
				<div className="h-3 w-full rounded bg-muted" />
				<div className="h-3 w-5/6 rounded bg-muted" />
				<div className="h-3 w-4/6 rounded bg-muted" />
			</div>
			<div className="mt-4 flex justify-between">
				<div className="h-8 w-1/4 rounded bg-muted" />
				<div className="h-8 w-1/4 rounded bg-muted" />
			</div>
		</div>
	);
}

export function ButtonLoader({ size = 'sm' }: { size?: PendingSize }) {
	return <Loader2 className={cn('mr-2 animate-spin', sizeClasses[size])} />;
}

// Utility function for size classes
const sizeClasses: Record<PendingSize, string> = {
	xs: 'h-3 w-3',
	sm: 'h-4 w-4',
	md: 'h-6 w-6',
	lg: 'h-8 w-8',
	xl: 'h-12 w-12',
};
