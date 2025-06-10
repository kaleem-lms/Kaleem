import { createFileRoute } from "@tanstack/react-router";
// This guards all routes under /_authenticated/*
import { useAuth } from "@/components/AuthContext";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/(auth)/_index/gg")({
	component: RouteComponent,
});

export function RouteComponent() {
	const { user } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		console.log(`user: ${user}`);
		if (!user) {
			navigate({ to: "/login" });
		}
	}, [user, navigate]);

	if (!user) return <h1>Loading...</h1>;

	return (
		<>
			asdfasdfasdf
			<Outlet />
		</>
	);
}
