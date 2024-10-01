import { Outlet, ScrollRestoration } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function RootComponent() {
	const { t, i18n } = useTranslation();

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng); // dynamically switch languages
	};

	return (
		<>
			<Outlet />
			<ScrollRestoration />
			<div>
				<h1>{t("welcome")}</h1>
				<Button onClick={() => changeLanguage("en")}>English</Button>
				<Button onClick={() => changeLanguage("ar")}>عربي</Button>
				<Button onClick={() => changeLanguage("fr")}>Française</Button>
			</div>
		</>
	);
}
