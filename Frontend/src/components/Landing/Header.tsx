import { Frame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Link } from '@tanstack/react-router'
import { HeaderDropdown } from '../Header/HeaderDropdown'

const Header = () => {
  return (
    <header className="bg-background border-b h-fit">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-fit">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img
                src="/kaleem/cover.svg"
                className="w-[30vw] h-[15vh]"
                alt=""
              />
            </Link>
            <nav className="hidden md:ml-6 md:flex md:space-x-4">
              <Link
                to="/about"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                About Us
              </Link>
              <Link
                to="/programs"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                Programs
              </Link>
              <Link
                to="/terms"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                Terms & Conditions
              </Link>
              <Link
                to="/pricing"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                Pricing
              </Link>
              <Link
                to="/login"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-lg font-semibold"
              >
                Login
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
