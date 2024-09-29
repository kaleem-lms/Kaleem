import getUser from "@/api/user/getUser";
import { useUser } from "@/store/useUser";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, ScrollRestoration } from "@tanstack/react-router";
import { useEffect } from "react";

export default function RootComponent() {
	const { data: user, isLoading } = useQuery({
		queryKey: ["user"],
		queryFn: getUser,
	});

	const { setUser } = useUser();

	useEffect(() => {
		if (isLoading) return;
		setUser(user);
	}, [setUser, user, isLoading]);

	if (isLoading) return <div>Loading...</div>; 

	return (
		<>
			<Outlet />
			<ScrollRestoration />
			<h1>Hello {user?.name}</h1>
		</>
	);
}
