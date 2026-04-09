'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, PlusCircle, LayoutDashboard, Shield } from 'lucide-react';

import { useAuth } from './AuthProvider';

export default function Navigation() {
  const pathname = usePathname();
  const { user, role } = useAuth();

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">BookManager</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className={`${
                  pathname === '/'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              {(role === 'admin' || role === 'coordinator') && (
                <Link
                  href="/add"
                  className={`${
                    pathname === '/add'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Order
                </Link>
              )}
              {role === 'admin' && (
                <Link
                  href="/admin"
                  className={`${
                    pathname === '/admin'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
