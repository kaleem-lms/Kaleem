import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
	value: number;
	onChange: (value: number) => void;
	max?: number;
	className?: string;
}

export function StarRating({ value, onChange, max = 5, className }: StarRatingProps) {
	return (
		<div className={cn('flex items-center gap-1', className)}>
			{Array.from({ length: max }, (_, i) => i + 1).map((star) => (
				<button
					key={star}
					type="button"
					onClick={() => onChange(star)}
					className="transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
					aria-label={`Rate ${star} out of ${max} stars`}
				>
					<Star
						className={cn(
							'h-6 w-6 transition-colors',
							star <= value ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted-foreground hover:text-yellow-400',
						)}
					/>
				</button>
			))}
			<span className="ml-2 text-sm text-muted-foreground">
				{value} / {max}
			</span>
		</div>
	);
}
