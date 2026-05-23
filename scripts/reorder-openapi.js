import { readFileSync, writeFileSync } from 'fs';
import { parseDocument, YAMLMap } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

const yamlPath = join(projectRoot, 'openapi.yaml');

const routeCategories = {
  Auth: [
    '/auth/me',
    '/auth/validate-token',
    '/auth/signup',
    '/auth/verify-email',
    '/auth/verify-email-otp',
    '/auth/login',
    '/auth/hospital/login',
    '/auth/admin/login',
    '/auth/logout',
    '/auth/refresh-token',
    '/auth/forgot-password',
    '/auth/verify-otp',
    '/auth/reset-password',
    '/auth/change-password',
    '/auth/2fa/setup',
    '/auth/2fa/confirm-setup',
    '/auth/2fa/verify',
    '/auth/2fa/disable',
    '/auth/fcm-token',
  ],
  Donor: [
    // Dashboard & Activity
    '/donor/dashboard',
    '/donor/activity',
    '/donor/recent-activity',
    '/dashboard',
    '/activity',

    // Profile & Health Profile
    '/donor/profile',
    '/donor/settings',
    '/donor/availability',
    '/donor/donation-eligibility',
    '/donor/health-history',

    // Appointments & Bookings
    '/donations/book-appointment',
    '/donations/book-appointment/available-slots',
    '/donations/book-appointment/my-appointments',
    '/donations/book-appointment/{appointmentId}',
    '/donations/types',
    '/donations/validate',
    '/donations/my-appointments',

    // Urgent Requests & Responses
    '/donor/requests',
    '/donor/matches',
    '/donor/respond/{requestId}',
    '/donor/urgent-requests',
    '/donor/urgent-requests/{requestId}',
    '/donor/urgent-requests/{requestId}/accept',
    '/donor/urgent-requests/{requestId}/decline',
    '/urgent-requests',
    '/urgent-requests/{requestId}',
    '/urgent-requests/{requestId}/accept',
    '/urgent-requests/{requestId}/decline',

    // Request Discovery & Exploration
    '/requests/nearby',
    '/requests/{id}',
    '/requests/{id}/google-maps',
    '/requests/{id}/accept',
    '/requests/{id}/cancel',

    // Hospitals & Locations
    '/hospitals',
    '/hospitals/nearby',
    '/hospitals/search',
    '/hospitals/map',
    '/hospitals/{id}',

    // Rewards, Badges & Leaderboard
    '/donor/rewards',
    '/donor/points',
    '/donor/badges',
    '/donor/stats',
    '/donor/history',
    '/donor/donations',
    '/donor/redemptions',
    '/rewards/points',
    '/rewards/earning-rules',
    '/rewards/dashboard',
    '/rewards/stats',
    '/rewards/points/history',
    '/rewards/badges',
    '/rewards/catalog',
    '/rewards/history',
    '/rewards/catalog/{rewardId}/redeem',
    '/rewards/redemptions',
    '/rewards/leaderboard',
    '/badges',

    // Help & Support
    '/help/faq',
    '/help/documents/{type}',
    '/support/contact',

    // Notifications
    '/notifications',
    '/notifications/read-all',
    '/notifications/{id}/read',
    '/notifications/{id}',

    // Analytics & Performance
    '/analytics/my-stats',
    '/analytics/leaderboard',
    '/analytics/donation-types',
  ],
  Hospital: [
    // Dashboard & Analytics
    '/hospital/dashboard',
    '/hospital/reports/monthly',

    // Profile & Configuration
    '/hospital/profile',
    '/hospital/appointment-settings',
    '/hospital/blood-bank-settings',
    '/hospital/notification-preferences',

    // Inventory Management
    '/hospital/blood-inventory',

    // Blood Requests & Donations
    '/hospital/request',
    '/hospital/requests',
    '/hospital/requests/{requestId}',
    '/hospital/requests/{requestId}/close',
    '/hospital/find-donors',
    '/hospital/donors/{donorId}/appointments',
    '/hospital/donations',
    '/donations/complete',

    // QR Code & Arrival Verification
    '/appointments/verify-qr',
    '/appointments/{appointmentId}/arrival',
    '/appointments/{appointmentId}/reject',
    '/appointments/{appointmentId}/rescan',
    '/requests/{id}/generate-qr',
    '/requests/verify-qr',
  ],
  Admin: [
    // System & Health
    '/admin/system/health',
    '/admin/system/maintenance',
    '/admin/audit-logs',
    '/api/webhooks/resend',
    '/health',
    '/',

    // Dashboard & Statistics
    '/admin/dashboard',
    '/admin/statistics',
    '/admin/blood-inventory-summary',
    '/admin/alerts',
    '/admin/analytics/dashboard',
    '/admin/analytics/donations',
    '/admin/analytics/blood-types',
    '/admin/analytics/top-donors',
    '/admin/analytics/growth',
    '/analytics/dashboard',

    // Rewards
    '/admin/rewards/config',
    '/rewards/admin/users/{userId}/points/adjust',
    '/rewards/admin/catalog/{rewardId}/status',
    '/rewards/admin/analytics',

    // Inbound Emails
    '/admin/inbound-emails',
    '/admin/inbound-emails/{id}',
    '/admin/inbound-emails/{id}/read',
    '/admin/inbound-emails/{id}/archive',

    // User Management
    '/admin/profile',
    '/admin/users',
    '/admin/users/stats',
    '/admin/users/hospital',
    '/admin/users/{id}',
    '/admin/users/{id}/verify',
    '/admin/users/{id}/unverify',
    '/admin/users/{id}/suspend',
    '/admin/users/{id}/unsuspend',
    '/admin/donors',
    '/admin/hospitals',
    '/admin/donors/{id}',
    '/admin/hospitals/{id}',
    '/admin/donors/{id}/ban',
    '/admin/donors/{id}/unban',
    '/admin/hospitals/{id}/status',
    '/admin/admins',
    '/admin/admins/{id}',
    '/admin/permissions/roles',
    '/admin/permissions/roles/{role}',

    // Requests & Moderation
    '/admin/requests',
    '/admin/requests/stats',
    '/admin/requests/{id}',
    '/admin/requests/{id}/donations',
    '/admin/requests/{id}/fulfill',
    '/admin/requests/{id}/cancel',
    '/admin/requests/{id}/broadcast',
    '/admin/emergency/broadcast',
    '/admin/emergency/critical',
    '/admin/emergency/shortage-alerts',
  ],
};

// Flatten to check which category a path belongs to
const getPathCategory = (path) => {
  for (const [category, paths] of Object.entries(routeCategories)) {
    if (paths.includes(path)) {
      return category;
    }
  }
  return null;
};

try {
  const content = readFileSync(yamlPath, 'utf8');
  const doc = parseDocument(content);
  
  // 1. Update top-level tags
  const tagsNode = doc.get('tags');
  if (tagsNode) {
    tagsNode.items = [
      { name: 'Auth', description: 'Registration, login, email verification, password reset, 2FA, and token management for all roles' },
      { name: 'Donor', description: 'All donor-facing endpoints: profile, dashboard, urgent requests, appointments, donation history, rewards, badges, activity, settings, notifications, hospitals, and analytics' },
      { name: 'Hospital', description: 'Hospital self-management: profile, blood bank, capacity, QR verification, request management' },
      { name: 'Admin', description: 'Admin operations: user management, analytics, rewards, system maintenance, metrics, audit logs, and inbound email management' }
    ].map(t => doc.createNode(t));
  }
  
  // 2. Access paths node
  const pathsNode = doc.get('paths');
  if (!pathsNode) {
    throw new Error('paths node not found in openapi.yaml');
  }
  
  const allPathsInYaml = pathsNode.items.map(item => typeof item.key === 'object' && item.key !== null ? item.key.value : item.key);
  console.log(`Found ${allPathsInYaml.length} paths in openapi.yaml`);
  
  // Check for any unclassified paths
  for (const path of allPathsInYaml) {
    const category = getPathCategory(path);
    if (!category) {
      console.warn(`⚠️ Warning: Path "${path}" is not classified in routeCategories! Defaulting to Admin.`);
    }
  }
  
  // 3. For each path and method, enforce correct tag
  for (const path of allPathsInYaml) {
    const category = getPathCategory(path) || 'Admin';
    const pathValue = pathsNode.get(path);
    if (pathValue && typeof pathValue.get === 'function') {
      const methods = ['get', 'post', 'put', 'delete', 'patch'];
      for (const m of methods) {
        const methodNode = pathValue.get(m);
        if (methodNode && typeof methodNode.set === 'function') {
          // Set tag
          methodNode.set('tags', doc.createNode([category]));
        }
      }
    }
  }
  
  // 4. Sort and rebuild paths
  const sortedPathsMap = new YAMLMap();
  
  // We want to sort according to the exact order defined in routeCategories
  const categoriesOrder = ['Auth', 'Donor', 'Hospital', 'Admin'];
  
  for (const category of categoriesOrder) {
    const pathsInCat = routeCategories[category];
    for (const pathPattern of pathsInCat) {
      if (pathsNode.has(pathPattern)) {
        sortedPathsMap.set(pathPattern, pathsNode.get(pathPattern));
      }
    }
  }
  
  // Add any path that was in YAML but not in our routeCategories array (for safety)
  for (const path of allPathsInYaml) {
    if (!sortedPathsMap.has(path)) {
      sortedPathsMap.set(path, pathsNode.get(path));
    }
  }
  
  // Replace paths in document
  doc.set('paths', sortedPathsMap);
  
  // Write document back
  writeFileSync(yamlPath, doc.toString(), 'utf8');
  console.log('✓ Successfully sorted and tagged openapi.yaml paths');
} catch (err) {
  console.error('Failed to run reorder-openapi script:', err);
  process.exit(1);
}
