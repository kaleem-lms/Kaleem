import { motion } from 'framer-motion';

export function LoadingScreen() {
	return (
		<div className="fixed inset-0 flex items-center justify-center bg-background">
			<div className="flex flex-col items-center text-center">
				<motion.div
					className="h-24 w-24 rounded-full border-primary border-t-4"
					animate={{ rotate: 360 }}
					transition={{
						duration: 1,
						repeat: Number.POSITIVE_INFINITY,
						ease: 'linear',
					}}
				/>
				<motion.h2
					className="mt-4 font-arabic text-2xl text-foreground"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.5 }}
				>
					بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
				</motion.h2>
				<motion.p
					className="mt-2 text-muted-foreground"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1 }}
				>
					Loading your content
				</motion.p>
			</div>
		</div>
	);
}
