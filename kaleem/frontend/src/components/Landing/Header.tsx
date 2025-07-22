import { Link } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const Header = () => {
	const { i18n, t } = useTranslation();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const [menuHeight, setMenuHeight] = useState(0);

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
	};

	const toggleMenu = () => {
		setIsMenuOpen(!isMenuOpen);
	};

	// Calculate and update menu height when it opens/closes or on resize
	useEffect(() => {
		if (menuRef.current) {
			if (isMenuOpen) {
				setMenuHeight(menuRef.current.scrollHeight);
			} else {
				setMenuHeight(0);
			}
		}
	}, [isMenuOpen]);

	// Update height on window resize if menu is open
	useEffect(() => {
		const handleResize = () => {
			if (isMenuOpen && menuRef.current) {
				setMenuHeight(menuRef.current.scrollHeight);
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [isMenuOpen]);

	return (
		<header className="relative border-b bg-background">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between py-4">
					{/* Logo */}
					<div className="flex items-center">
						<Link to="/" className="flex items-center">
							<img src="/kaleem/cover.svg" className="h-auto w-[120px] sm:w-[150px] md:w-[180px]" alt="Kaleem Logo" />
						</Link>
					</div>

					{/* Desktop Navigation */}
					<nav className="hidden md:flex md:items-center md:space-x-3">
						<Link to="/about" className="rounded-md px-2 py-1.5 font-extrabold text-gray-600 text-sm hover:text-primary">
							{t('About Us')}
						</Link>
						<Link to="/programs" className="rounded-md px-2 py-1.5 font-extrabold text-gray-600 text-sm hover:text-primary">
							{t('Programs')}
						</Link>
						<Link to="/curriculum" className="rounded-md px-2 py-1.5 font-extrabold text-gray-600 text-sm hover:text-primary">
							{t('Curriculum & Materials')}
						</Link>
						<Link to="/terms" className="rounded-md px-2 py-1.5 font-extrabold text-gray-600 text-sm hover:text-primary">
							{t('Terms & Conditions')}
						</Link>
						<Link to="/pricing" className="rounded-md px-2 py-1.5 font-extrabold text-gray-600 text-sm hover:text-primary">
							{t('Pricing')}
						</Link>
						<Link to="/login" className="rounded-md px-2 py-1.5 font-extrabold text-gray-600 text-sm hover:text-primary">
							{t('Login')}
						</Link>
					</nav>

					{/* Language Selector and Mobile Menu Button */}
					<div className="flex items-center space-x-4">
						<div className="relative z-10">
							<Select value={i18n.language} onValueChange={changeLanguage}>
								<SelectTrigger id="language-select" className="w-[100px] sm:w-[120px]">
									<SelectValue placeholder="Language" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="en">English</SelectItem>
									<SelectItem value="ar">العربية</SelectItem>
									<SelectItem value="fr">Français</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Mobile Menu Button */}
						<button
							type="button"
							className="rounded-md p-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-primary focus:outline-none md:hidden"
							onClick={toggleMenu}
							aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
							aria-expanded={isMenuOpen}
						>
							{isMenuOpen ? <X size={24} /> : <Menu size={24} />}
						</button>
					</div>
				</div>
			</div>

			{/* Mobile Menu - Always rendered but height animated */}
			<div
				ref={menuRef}
				className="overflow-hidden border-t bg-background transition-all duration-300 ease-in-out md:hidden"
				style={{ height: `${menuHeight}px`, opacity: menuHeight > 0 ? 1 : 0 }}
				aria-hidden={!isMenuOpen}
			>
				<div className="container mx-auto space-y-2 px-4 py-3">
					<Link
						to="/about"
						className="block rounded-md px-2 py-2 font-extrabold text-base text-gray-600 hover:text-primary"
						onClick={() => setIsMenuOpen(false)}
					>
						{t('About Us')}
					</Link>
					<Link
						to="/programs"
						className="block rounded-md px-2 py-2 font-extrabold text-base text-gray-600 hover:text-primary"
						onClick={() => setIsMenuOpen(false)}
					>
						{t('Programs')}
					</Link>
					<Link
						to="/curriculum"
						className="block rounded-md px-2 py-2 font-extrabold text-base text-gray-600 hover:text-primary"
						onClick={() => setIsMenuOpen(false)}
					>
						{t('Curriculum & Materials')}
					</Link>
					<Link
						to="/terms"
						className="block rounded-md px-2 py-2 font-extrabold text-base text-gray-600 hover:text-primary"
						onClick={() => setIsMenuOpen(false)}
					>
						{t('Terms & Conditions')}
					</Link>
					<Link
						to="/pricing"
						className="block rounded-md px-2 py-2 font-extrabold text-base text-gray-600 hover:text-primary"
						onClick={() => setIsMenuOpen(false)}
					>
						{t('Pricing')}
					</Link>
					<Link
						to="/login"
						className="block rounded-md px-2 py-2 font-extrabold text-base text-gray-600 hover:text-primary"
						onClick={() => setIsMenuOpen(false)}
					>
						{t('Login')}
					</Link>
				</div>
			</div>
		</header>
	);
};

export default Header;
