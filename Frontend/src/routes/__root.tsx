import { createRootRoute } from "@tanstack/react-router";
import RootComponent from "@/components/RootComponent";

export const Route = createRootRoute({
	component: RootComponent,
	notFoundComponent: () => (
		<div className="text-red-500 text-5xl font-bold">Not Found</div>
	),
	errorComponent: () => (
		<div className="text-red-500 text-5xl font-bold">Error</div>
	),
});
