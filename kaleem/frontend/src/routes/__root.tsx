import { createRootRoute } from '@tanstack/react-router';
import NotFoundPage from '@/components/404';
import { FullPageLoading } from '@/components/Pending';
import RootComponent from '@/components/RootComponent';

export const Route = createRootRoute({
	component: RootComponent,
	notFoundComponent: NotFoundPage,
	pendingComponent: FullPageLoading,
});
