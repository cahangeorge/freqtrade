/**
 * Settings page for user preferences.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { toast } from '../components/common/Toast';
import { format } from 'date-fns';

// Export utility functions
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function arrayToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.join(',');
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      const str = value === null || value === undefined ? '' : String(value);
      // Escape values with commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [headerRow, ...rows].join('\n');
}

export function Settings() {
  const { user, updateUser } = useAuthStore();

  const [theme, setTheme] = useState<string>((user?.preferences?.theme as string) || 'system');
  const [notifications, setNotifications] = useState(
    (user?.preferences?.notifications_enabled as boolean) ?? true
  );
  const [refreshInterval, setRefreshInterval] = useState<number>(
    (user?.preferences?.refresh_interval as number) || 30
  );
  const [defaultView, setDefaultView] = useState<string>(
    (user?.preferences?.default_view as string) || 'grid'
  );
  const [alertCritical, setAlertCritical] = useState(
    (user?.preferences?.alert_critical as boolean) ?? true
  );
  const [alertWarning, setAlertWarning] = useState(
    (user?.preferences?.alert_warning as boolean) ?? true
  );
  const [alertInfo, setAlertInfo] = useState(
    (user?.preferences?.alert_info as boolean) ?? false
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updatePreferences = useMutation({
    mutationFn: async (prefs: Record<string, unknown>) => {
      const response = await api.patch<{ preferences?: Record<string, unknown> }>('/users/me/preferences', prefs);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Preferences updated');
      if (updateUser && user && data?.preferences) {
        updateUser({ ...user, preferences: data.preferences });
      }
    },
    onError: (error: Error) => {
      toast.error((error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to update preferences');
    },
  });

  const changePassword = useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      const response = await api.patch('/users/me/password', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    },
  });

  const handleSavePreferences = () => {
    updatePreferences.mutate({
      theme,
      notifications_enabled: notifications,
      refresh_interval: refreshInterval,
      default_view: defaultView,
      alert_critical: alertCritical,
      alert_warning: alertWarning,
      alert_info: alertInfo,
    });
  };

  // Password validation helper
  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    return { valid: errors.length === 0, errors };
  };

  const passwordValidation = validatePassword(newPassword);
  const passwordStrength = newPassword.length === 0 ? 0 :
    passwordValidation.valid ? 4 :
    4 - passwordValidation.errors.length;

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!passwordValidation.valid) {
      toast.error('Password does not meet requirements');
      return;
    }
    changePassword.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportBots = async () => {
    setIsExporting('bots');
    try {
      const response = await api.get<any[]>('/bots');
      const bots = response.data || [];

      if (bots.length === 0) {
        toast.info('No bots to export');
        return;
      }

      const exportData = bots.map(bot => ({
        id: bot.id,
        name: bot.name,
        environment: bot.environment,
        health_state: bot.health_state,
        exchange: bot.exchange || '',
        strategy: bot.strategy || '',
        is_dryrun: bot.is_dryrun ? 'Yes' : 'No',
        api_url: bot.api_url || '',
        tags: (bot.tags || []).join(';'),
        last_seen: bot.last_seen || '',
        created_at: bot.created_at || '',
      }));

      const headers = ['id', 'name', 'environment', 'health_state', 'exchange', 'strategy', 'is_dryrun', 'api_url', 'tags', 'last_seen', 'created_at'];
      const csv = arrayToCSV(exportData, headers);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      downloadFile(csv, `bots_export_${timestamp}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`Exported ${bots.length} bots`);
    } catch (error) {
      toast.error('Failed to export bots');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportTrades = async () => {
    setIsExporting('trades');
    try {
      // First get all bots, then fetch trades for each
      const botsResponse = await api.get<any[]>('/bots');
      const bots = botsResponse.data || [];

      const allTrades: any[] = [];

      for (const bot of bots) {
        try {
          const tradesResponse = await api.get<any[]>(`/bots/${bot.id}/trades`);
          const trades = tradesResponse.data || [];
          trades.forEach(trade => {
            allTrades.push({
              bot_id: bot.id,
              bot_name: bot.name,
              trade_id: trade.id,
              pair: trade.pair,
              side: trade.is_short ? 'SHORT' : 'LONG',
              leverage: trade.leverage || 1,
              open_date: trade.open_date,
              close_date: trade.close_date || '',
              open_rate: trade.open_rate,
              close_rate: trade.close_rate || '',
              stake_amount: trade.stake_amount || '',
              amount: trade.amount || '',
              profit_pct: trade.close_profit !== undefined ? (trade.close_profit * 100).toFixed(4) : '',
              profit_abs: trade.close_profit_abs || '',
              exit_reason: trade.exit_reason || '',
              is_open: trade.is_open ? 'Yes' : 'No',
            });
          });
        } catch {
          // Skip bots that fail to fetch trades
        }
      }

      if (allTrades.length === 0) {
        toast.info('No trades to export');
        return;
      }

      const headers = ['bot_id', 'bot_name', 'trade_id', 'pair', 'side', 'leverage', 'open_date', 'close_date', 'open_rate', 'close_rate', 'stake_amount', 'amount', 'profit_pct', 'profit_abs', 'exit_reason', 'is_open'];
      const csv = arrayToCSV(allTrades, headers);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      downloadFile(csv, `trades_export_${timestamp}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`Exported ${allTrades.length} trades from ${bots.length} bots`);
    } catch (error) {
      toast.error('Failed to export trades');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportAlerts = async () => {
    setIsExporting('alerts');
    try {
      const response = await api.get<{ data: any[] }>('/alerts?limit=1000');
      const alerts = response.data?.data || [];

      if (alerts.length === 0) {
        toast.info('No alerts to export');
        return;
      }

      const exportData = alerts.map(alert => ({
        id: alert.id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        bot_id: alert.bot_id,
        bot_name: alert.bot_name,
        is_read: alert.is_read,
        is_dismissed: alert.is_dismissed,
        created_at: alert.created_at,
      }));

      const json = JSON.stringify(exportData, null, 2);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      downloadFile(json, `alerts_export_${timestamp}.json`, 'application/json');
      toast.success(`Exported ${alerts.length} alerts`);
    } catch (error) {
      toast.error('Failed to export alerts');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Appearance Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Appearance
        </h2>

        <div className="space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="block w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose your preferred color scheme
            </p>
          </div>

          {/* Default View */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Dashboard View
            </label>
            <select
              value={defaultView}
              onChange={(e) => setDefaultView(e.target.value)}
              className="block w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="grid">Grid View</option>
              <option value="table">Table View</option>
              <option value="compact">Compact View</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How bots are displayed on the dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Dashboard Settings
        </h2>

        <div className="space-y-4">
          {/* Refresh Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data Refresh Interval
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="block w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={10}>Every 10 seconds</option>
              <option value={30}>Every 30 seconds</option>
              <option value={60}>Every 1 minute</option>
              <option value={120}>Every 2 minutes</option>
              <option value={300}>Every 5 minutes</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How often bot data is refreshed automatically
            </p>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Notifications
        </h2>

        <div className="space-y-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between max-w-md">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Notifications
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Show alerts in the notification bell
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotifications(!notifications)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                notifications ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  notifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {notifications && (
            <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Alert Types</p>

              {/* Critical Alerts */}
              <div className="flex items-center justify-between max-w-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Critical Alerts
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertCritical(!alertCritical)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    alertCritical ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      alertCritical ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Warning Alerts */}
              <div className="flex items-center justify-between max-w-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Warning Alerts
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertWarning(!alertWarning)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    alertWarning ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      alertWarning ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Info Alerts */}
              <div className="flex items-center justify-between max-w-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Info Alerts
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertInfo(!alertInfo)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    alertInfo ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      alertInfo ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSavePreferences}
          disabled={updatePreferences.isPending}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
        >
          {updatePreferences.isPending ? 'Saving...' : 'Save All Preferences'}
        </button>
      </div>

      {/* Change Password Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Change Password
        </h2>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            />
            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded ${
                        passwordStrength >= level
                          ? passwordStrength >= 4
                            ? 'bg-green-500'
                            : passwordStrength >= 3
                            ? 'bg-yellow-500'
                            : passwordStrength >= 2
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                          : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${passwordValidation.valid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {passwordValidation.valid
                    ? 'Password meets all requirements'
                    : `Missing: ${passwordValidation.errors.join(', ')}`}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`block w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 ${
                confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
            {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length > 0 && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Passwords match</p>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changePassword.isPending || !currentPassword || !newPassword}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {changePassword.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Account Information
        </h2>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Username</p>
            <p className="text-gray-900 dark:text-white font-medium">{user?.username}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Role</p>
            <p className="text-gray-900 dark:text-white font-medium capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Data Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Data Export
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Export your bot data and trade history for analysis or backup purposes.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportBots}
              disabled={isExporting === 'bots'}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting === 'bots' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Export Bots (CSV)
            </button>

            <button
              onClick={handleExportTrades}
              disabled={isExporting === 'trades'}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting === 'trades' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Export Trades (CSV)
            </button>

            <button
              onClick={handleExportAlerts}
              disabled={isExporting === 'alerts'}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting === 'alerts' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Export Alerts (JSON)
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Keyboard Shortcuts
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Search bots</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+K</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Toggle theme</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+Shift+T</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Go to dashboard</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">G then D</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Go to settings</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">G then S</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
