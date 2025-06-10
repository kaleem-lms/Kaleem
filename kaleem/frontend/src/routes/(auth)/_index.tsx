import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/_index")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			Hello "/(auth)/"!
			<Outlet />
		</div>
	);
}
