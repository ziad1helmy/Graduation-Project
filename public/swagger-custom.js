(function() {
  const subGroups = {
    // Auth
    '/auth/me': 'Session & Token Info',
    '/auth/validate-token': 'Session & Token Info',

    '/auth/signup': 'Registration & Verification',
    '/auth/verify-email': 'Registration & Verification',
    '/auth/verify-email-otp': 'Registration & Verification',

    '/auth/login': 'Authentication',
    '/auth/hospital/login': 'Authentication',
    '/auth/admin/login': 'Authentication',
    '/auth/logout': 'Authentication',
    '/auth/refresh-token': 'Authentication',

    '/auth/forgot-password': 'Password Recovery & Changes',
    '/auth/verify-otp': 'Password Recovery & Changes',
    '/auth/reset-password': 'Password Recovery & Changes',
    '/auth/change-password': 'Password Recovery & Changes',


    '/auth/fcm-token': 'Push Notifications',

    // Donor
    '/donor/dashboard': 'Dashboard & Activity',
    '/donor/activity': 'Dashboard & Activity',
    '/donor/recent-activity': 'Dashboard & Activity',
    '/dashboard': 'Dashboard & Activity',
    '/activity': 'Dashboard & Activity',

    '/donor/profile': 'Profile & Health Profile',
    '/donor/settings': 'Profile & Health Profile',
    '/donor/availability': 'Profile & Health Profile',
    '/donor/donation-eligibility': 'Profile & Health Profile',

    '/donations/book-appointment': 'Appointments & Bookings',
    '/donations/book-appointment/available-slots': 'Appointments & Bookings',
    '/donations/book-appointment/my-appointments': 'Appointments & Bookings',
    '/donations/book-appointment/{appointmentId}': 'Appointments & Bookings',
    '/donations/types': 'Appointments & Bookings',
    '/donations/validate': 'Appointments & Bookings',

    '/donor/requests': 'Urgent Requests & Responses',
    '/donor/matches': 'Urgent Requests & Responses',
    '/donor/respond/{requestId}': 'Urgent Requests & Responses',
    '/donor/urgent-requests': 'Urgent Requests & Responses',
    '/donor/urgent-requests/{requestId}': 'Urgent Requests & Responses',
    '/donor/urgent-requests/{requestId}/accept': 'Urgent Requests & Responses',
    '/donor/urgent-requests/{requestId}/decline': 'Urgent Requests & Responses',
    '/urgent-requests': 'Urgent Requests & Responses',
    '/urgent-requests/{requestId}': 'Urgent Requests & Responses',
    '/urgent-requests/{requestId}/accept': 'Urgent Requests & Responses',
    '/urgent-requests/{requestId}/decline': 'Urgent Requests & Responses',

    '/requests/nearby': 'Request Discovery & Exploration',
    '/requests/{id}': 'Request Discovery & Exploration',
    '/requests/{id}/google-maps': 'Request Discovery & Exploration',
    '/requests/{id}/accept': 'Request Discovery & Exploration',
    '/requests/{id}/cancel': 'Request Discovery & Exploration',

    '/hospitals': 'Hospitals & Locations',
    '/hospitals/nearby': 'Hospitals & Locations',
    '/hospitals/search': 'Hospitals & Locations',
    '/hospitals/map': 'Hospitals & Locations',
    '/hospitals/{id}': 'Hospitals & Locations',

    '/donor/rewards': 'Rewards, Badges & Leaderboard',
    '/donor/points': 'Rewards, Badges & Leaderboard',
    '/donor/badges': 'Rewards, Badges & Leaderboard',
    '/donor/stats': 'Rewards, Badges & Leaderboard',
    '/donor/history': 'Rewards, Badges & Leaderboard',
    '/donor/donations': 'Rewards, Badges & Leaderboard',
    '/donor/redemptions': 'Rewards, Badges & Leaderboard',
    '/rewards/points': 'Rewards, Badges & Leaderboard',
    '/rewards/earning-rules': 'Rewards, Badges & Leaderboard',
    '/rewards/dashboard': 'Rewards, Badges & Leaderboard',
    '/rewards/stats': 'Rewards, Badges & Leaderboard',
    '/rewards/points/history': 'Rewards, Badges & Leaderboard',
    '/rewards/badges': 'Rewards, Badges & Leaderboard',
    '/rewards/catalog': 'Rewards, Badges & Leaderboard',
    '/rewards/history': 'Rewards, Badges & Leaderboard',
    '/rewards/catalog/{rewardId}/redeem': 'Rewards, Badges & Leaderboard',
    '/rewards/redemptions': 'Rewards, Badges & Leaderboard',
    '/rewards/leaderboard': 'Rewards, Badges & Leaderboard',
    '/badges': 'Rewards, Badges & Leaderboard',

    '/help/faq': 'Help & Support',
    '/help/documents/{type}': 'Help & Support',
    '/support/contact': 'Help & Support',

    '/notifications': 'Notifications',
    '/notifications/read-all': 'Notifications',
    '/notifications/{id}/read': 'Notifications',
    '/notifications/{id}': 'Notifications',

    '/analytics/my-stats': 'Analytics & Performance',
    '/analytics/leaderboard': 'Analytics & Performance',
    '/analytics/donation-types': 'Analytics & Performance',

    // Hospital
    '/hospital/dashboard': 'Dashboard & Analytics',
    '/hospital/reports/monthly': 'Dashboard & Analytics',
    '/hospital/activity': 'Dashboard & Analytics',

    '/hospital/profile': 'Profile & Configuration',
    '/hospital/profile/location': 'Profile & Configuration',
    '/hospital/appointment-settings': 'Profile & Configuration',
    '/hospital/blood-bank-settings': 'Profile & Configuration',
    '/hospital/notification-preferences': 'Profile & Configuration',

    // '/hospital/blood-inventory': 'Inventory Management', // removed — endpoint deleted

    '/hospital/request': 'Blood Requests & Donations',
    '/hospital/requests': 'Blood Requests & Donations',
    '/hospital/requests/{requestId}': 'Blood Requests & Donations',
    '/hospital/requests/{requestId}/close': 'Blood Requests & Donations',
    '/hospital/requests/{requestId}/responses': 'Blood Requests & Donations',
    '/hospital/confirm-donation': 'Blood Requests & Donations',
    '/hospital/find-donors': 'Blood Requests & Donations',
    '/hospital/donors/{donorId}/appointments': 'Blood Requests & Donations',
    '/hospital/donations': 'Blood Requests & Donations',
    '/donations/complete': 'Blood Requests & Donations',

    '/appointments/verify-qr': 'QR Code & Arrival Verification',
    '/appointments/{appointmentId}/arrival': 'QR Code & Arrival Verification',
    '/appointments/{appointmentId}/reject': 'QR Code & Arrival Verification',
    '/appointments/{appointmentId}/rescan': 'QR Code & Arrival Verification',
    '/requests/{id}/generate-qr': 'QR Code & Arrival Verification',
    '/requests/verify-qr': 'QR Code & Arrival Verification',

    // Admin
    '/admin/system/health': 'System & Health',
    '/admin/system/maintenance': 'System & Health',
    '/admin/audit-logs': 'System & Health',
    '/api/webhooks/resend': 'System & Health',
    '/health': 'System & Health',
    '/': 'System & Health',

    '/admin/dashboard': 'Dashboard & Statistics',
    '/admin/statistics': 'Dashboard & Statistics',
    '/admin/blood-inventory-summary': 'Dashboard & Statistics',
    '/admin/alerts': 'Dashboard & Statistics',
    '/admin/analytics/donations': 'Dashboard & Statistics',
    '/admin/analytics/blood-types': 'Dashboard & Statistics',
    '/admin/analytics/top-donors': 'Dashboard & Statistics',
    '/admin/analytics/growth': 'Dashboard & Statistics',
    '/analytics/dashboard': 'Dashboard & Statistics',
    '/analytics/overview': 'Dashboard & Statistics',

    '/admin/rewards/config': 'Rewards',
    '/rewards/admin/users/{userId}/points/adjust': 'Rewards',
    '/rewards/admin/catalog/{rewardId}/status': 'Rewards',
    '/rewards/admin/analytics': 'Rewards',

    '/admin/inbound-emails': 'Inbound Emails',
    '/admin/inbound-emails/{id}': 'Inbound Emails',
    '/admin/inbound-emails/{id}/read': 'Inbound Emails',
    '/admin/inbound-emails/{id}/archive': 'Inbound Emails',

    '/admin/profile': 'User Management',
    '/admin/users': 'User Management',
    '/admin/users/stats': 'User Management',
    '/admin/users/hospital': 'User Management',
    '/admin/users/{id}': 'User Management',
    '/admin/users/{id}/verify': 'User Management',
    '/admin/users/{id}/unverify': 'User Management',
    '/admin/users/{id}/suspend': 'User Management',
    '/admin/users/{id}/unsuspend': 'User Management',
    '/admin/donors': 'User Management',
    '/admin/hospitals': 'User Management',
    '/admin/donors/{id}': 'User Management',
    '/admin/hospitals/{id}': 'User Management',
    '/admin/donors/{id}/ban': 'User Management',
    '/admin/donors/{id}/unban': 'User Management',
    '/admin/hospitals/{id}/status': 'User Management',
    '/admin/admins': 'User Management',
    '/admin/admins/{id}': 'User Management',
    '/admin/permissions/roles': 'User Management',
    '/admin/permissions/roles/{role}': 'User Management',

    '/admin/requests': 'Requests & Moderation',
    '/admin/requests/stats': 'Requests & Moderation',
    '/admin/requests/{id}': 'Requests & Moderation',
    '/admin/requests/{id}/donations': 'Requests & Moderation',
    '/admin/requests/{id}/fulfill': 'Requests & Moderation',
    '/admin/requests/{id}/cancel': 'Requests & Moderation',
    '/admin/requests/{id}/broadcast': 'Requests & Moderation',
    '/admin/emergency/broadcast': 'Requests & Moderation',
    '/admin/emergency/critical': 'Requests & Moderation',
    '/admin/emergency/shortage-alerts': 'Requests & Moderation',
  };

  function applySubGroups() {
    const tagSections = document.querySelectorAll('.opblock-tag-section');
    if (tagSections.length === 0) return;

    tagSections.forEach(section => {
      // Find the main category tag name
      const tagSpan = section.querySelector('.opblock-tag span');
      if (!tagSpan) return;
      const tagName = tagSpan.textContent.trim();
      if (!['Auth', 'Donor', 'Hospital', 'Admin'].includes(tagName)) return;

      // Find all operation blocks under this tag section
      const opblocks = Array.from(section.querySelectorAll('.opblock'));
      let lastGroup = null;

      opblocks.forEach(opblock => {
        const pathEl = opblock.querySelector('.opblock-summary-path, .opblock-summary-path__deprecated');
        if (!pathEl) return;
        
        // Clean path text (remove zero-width spaces or other UI artifacts if any)
        const path = pathEl.textContent.trim().replace(/\u200B/g, '');
        const groupName = subGroups[path] || null;

        if (groupName) {
          if (groupName !== lastGroup) {
            // Check if there is already a custom header right before this operation block
            let prev = opblock.previousSibling;
            while (prev && prev.nodeType !== 1) { // Skip text/comment nodes
              prev = prev.previousSibling;
            }

            if (prev && prev.classList.contains('swagger-custom-group-header') && prev.textContent === groupName) {
              // Existing header is correct, keep it
            } else {
              // Create and insert new sub-group header
              const header = document.createElement('div');
              header.className = 'swagger-custom-group-header';
              header.textContent = groupName;
              opblock.parentNode.insertBefore(header, opblock);
            }
            lastGroup = groupName;
          } else {
            // Same group as previous, ensure there isn't an extra header injected in between
            let prev = opblock.previousSibling;
            while (prev && prev.nodeType !== 1) {
              prev = prev.previousSibling;
            }
            if (prev && prev.classList.contains('swagger-custom-group-header')) {
              prev.remove();
            }
          }
        }
      });
    });

    // Final clean up for stray headers (headers not followed by an opblock)
    document.querySelectorAll('.swagger-custom-group-header').forEach(header => {
      let next = header.nextSibling;
      while (next && next.nodeType !== 1) {
        next = next.nextSibling;
      }
      if (!next || !next.classList.contains('opblock')) {
        header.remove();
      }
    });
  }

  // Set up MutationObserver to dynamically group elements as Swagger UI loads and updates
  let isUpdating = false;
  const observer = new MutationObserver(() => {
    if (isUpdating) return;
    isUpdating = true;
    try {
      applySubGroups();
    } catch (e) {
      console.error('Error grouping Swagger endpoints:', e);
    } finally {
      isUpdating = false;
    }
  });

  // Start observing once the container is ready
  function initObserver() {
    const targetNode = document.getElementById('swagger-ui');
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true });
      applySubGroups(); // Initial run
    } else {
      setTimeout(initObserver, 100);
    }
  }

  // Trigger init on DOM load or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
})();
