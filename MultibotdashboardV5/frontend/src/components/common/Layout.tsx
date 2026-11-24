import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';
import { RateLimitIndicator } from './RateLimitIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';
import { NotificationBell } from '../Alerts';
import { useKeyboardShortcuts, keyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import logoImage from '../../assets/logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/' },
  { name: 'Historic', href: '/historic' },
  { name: 'Backtest', href: '/backtest' },
  { name: 'Alerts', href: '/alerts' },
  { name: 'Discovery', href: '/discovery' },
  { name: 'Compare', href: '/compare' },
  { name: 'Settings', href: '/settings' },
];

const adminNavigation = [{ name: 'Users', href: '/users' }];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { isConnected, connectionError } = useWebSocket();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Listen for shortcut help request
  useEffect(() => {
    const handler = () => setShowShortcuts(true);
    window.addEventListener('show-keyboard-shortcuts', handler);
    return () => window.removeEventListener('show-keyboard-shortcuts', handler);
  }, []);

  const allNavigation =
    user?.role === 'admin' ? [...navigation, ...adminNavigation] : navigation;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="AlexCryptoKing"
              className="h-10 w-10 object-contain rounded"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              Freqtrade
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <nav className="px-2 py-4 space-y-1">
          {allNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                location.pathname === item.href
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <img
              src={logoImage}
              alt="AlexCryptoKing"
              className="h-10 w-10 object-contain rounded"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              Freqtrade Dashboard
            </span>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {allNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                  location.pathname === item.href
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-4"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Global Search */}
          <GlobalSearch />

          <div className="flex-1" />

          {/* Right side controls */}
          <div className="flex items-center gap-4">
            {/* Rate Limit Indicator */}
            <RateLimitIndicator />

            {/* WebSocket connection status */}
            <div
              className="flex items-center gap-1.5 text-xs"
              title={connectionError || (isConnected ? 'Real-time updates active' : 'Connecting...')}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-green-500 animate-pulse'
                    : connectionError
                    ? 'bg-red-500'
                    : 'bg-yellow-500 animate-pulse'
                }`}
              />
              <span className="hidden sm:inline text-gray-500 dark:text-gray-400">
                {isConnected ? 'Live' : connectionError ? 'Offline' : 'Connecting'}
              </span>
            </div>
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowShortcuts(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <ul className="space-y-3">
                {keyboardShortcuts.map((shortcut, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-gray-400">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">?</kbd> anytime to show this dialog
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
