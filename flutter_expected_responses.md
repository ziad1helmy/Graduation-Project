# Flutter Expected Responses Contract

This document outlines the exact response structures the Flutter application expects from each API endpoint, derived solely from the parsing logic, models, and entities in the Flutter codebase.

---

### Endpoint

`GET /rewards/badges`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "unlockedCount": 0,
    "totalCount": 7,
    "completionPercentage": 0,
    "badges": [
      {
        "badgeId": "69f26027dc1ddc888014fcf2",
        "badgeName": "First Timer",
        "badgeDescription": "Completed your first blood donation",
        "badgeIcon": "heart",
        "category": "DONATION",
        "rarity": "COMMON",
        "unlockStatus": "LOCKED",
        "unlockedAt": null,
        "progressCurrent": 0,
        "progressTarget": 1,
        "progressPercentage": 0
      }
    ],
    "stats": {
      "totalDonations": 0,
      "totalEmergencyResponses": 0,
      "daysAsDonor": 0
    }
  }
}
```

### Consumed By

* **Model(s):** [BadgesModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/badges_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/badges_model.dart#L33), [Badges](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/badges_model.dart#L116), [Stats](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/badges_model.dart#L79)
* **DataSource(s):** [RewardsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/data_source/rewards_api_data_source.dart)
* **Repository(s):** [RewardsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/repositories/rewards_repositories_imp.dart)
* **Screen(s):** [badges_tab.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/badges_tab.dart), [rewards_screen.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_screen.dart)

---

### Endpoint

`GET /rewards/catalog`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "rewards": [
      {
        "_id": "69f26028dc1ddc888014fcf9",
        "id": "69f26028dc1ddc888014fcf9",
        "hospital_id": "69f3df915f42685cbbbcbb1b",
        "name": "Coffee Voucher",
        "__v": 0,
        "category": "FOOD",
        "colorCode": "#8B4513",
        "createdAt": "2026-04-29T19:46:48.671Z",
        "dailyLimit": null,
        "description": "Free coffee at partner cafes",
        "iconType": "coffee",
        "monthlyLimit": null,
        "pointsCost": 500,
        "redemptionCount": 0,
        "status": "ACTIVE",
        "updatedAt": "2026-05-11T16:28:47.791Z",
        "available": true
      }
    ],
    "filterOptions": {
      "categories": [
        "FOOD",
        "ENTERTAINMENT",
        "HEALTH",
        "STATUS"
      ]
    }
  }
}
```

### Consumed By

* **Model(s):** [RewardsModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/rewards_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/rewards_model.dart#L30), [Rewards](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/rewards_model.dart#L95), [FilterOptions](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/rewards_model.dart#L62)
* **DataSource(s):** [RewardsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/data_source/rewards_api_data_source.dart)
* **Repository(s):** [RewardsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/repositories/rewards_repositories_imp.dart)
* **Screen(s):** [rewards_tab.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_tab.dart), [rewards_screen.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_screen.dart)

---

### Endpoint

`POST /rewards/catalog/:rewardId/redeem`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "redemptionId": "6a0208c4927870ffe66837f9",
    "confirmationCode": "RWD-2026-2BD897",
    "rewardName": "Coffee Voucher",
    "pointsSpent": 500,
    "remainingPoints": 350,
    "redemptionStatus": "CONFIRMED",
    "expiresAt": "2026-06-10T16:50:12.734Z"
  }
}
```

### Consumed By

* **Model(s):** [RedeemReward](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/redeem_reward.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/redeem_reward.dart#L35)
* **DataSource(s):** [RewardsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/data_source/rewards_api_data_source.dart)
* **Repository(s):** [RewardsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/repositories/rewards_repositories_imp.dart)
* **Screen(s):** [rewards_tab.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_tab.dart), [rewards_screen.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_screen.dart)

---

### Endpoint

`GET /rewards/points`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "pointsBalance": 350,
    "lifetimePointsEarned": 950,
    "currentTier": "bronze",
    "nextTier": "silver",
    "pointsToNextTier": 50,
    "tierBenefits": {
      "bronze": [
        "Access to basic rewards"
      ],
      "silver": [
        "10% more points per donation",
        "Early access to limited rewards"
      ],
      "gold": [
        "15% more points per donation",
        "Exclusive gold rewards"
      ],
      "platinum": [
        "20% more points per donation",
        "VIP support",
        "All exclusive rewards"
      ]
    }
  }
}
```

### Consumed By

* **Model(s):** [PointsModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/points_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/points_model.dart#L34), [TierBenefits](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/points_model.dart#L78)
* **DataSource(s):** [RewardsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/data_source/rewards_api_data_source.dart)
* **Repository(s):** [RewardsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/repositories/rewards_repositories_imp.dart)
* **Screen(s):** [rewards_screen.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_screen.dart)

---

### Endpoint

`GET /rewards/points/history`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "6a0208c5927870ffe66837fa",
        "donorId": "69f3df915f42685cbbbcbb18",
        "pointsAmount": -500,
        "transactionType": "REWARD_REDEEMED",
        "description": "Reward Redeemed: Coffee Voucher",
        "referenceId": "6a0208c4927870ffe66837f9",
        "balanceAfter": 350,
        "adminId": null,
        "createdAt": "2026-05-11T16:50:13.050Z",
        "updatedAt": "2026-05-11T16:50:13.050Z",
        "__v": 0
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Consumed By

* **Model(s):** [PointsHistory](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/points_history.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/points_history.dart#L30), [Transactions](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/points_history.dart#L116), [Pagination](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/points_history.dart#L67)
* **DataSource(s):** [RewardsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/data_source/rewards_api_data_source.dart)
* **Repository(s):** [RewardsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/repositories/rewards_repositories_imp.dart)
* **Screen(s):** [rewards_screen.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_screen.dart)

---

### Endpoint

`GET /rewards/earning-rules`

### Flutter Expected Response

```json
{
  "success": true,
  "data": [
    {
      "type": "blood_donation",
      "title": "Blood Donation",
      "points": 200
    },
    {
      "type": "emergency_response",
      "title": "Emergency Response",
      "points": 100
    }
  ]
}
```

### Consumed By

* **Model(s):** [EarningRulesModels](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/earning_rules_models.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/model/earning_rules_models.dart#L36)
* **DataSource(s):** [RewardsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/data_source/rewards_api_data_source.dart)
* **Repository(s):** [RewardsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/data/repositories/rewards_repositories_imp.dart)
* **Screen(s):** [rewards_screen.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/rewards/rewards_screen.dart)

---

### Endpoint

`PUT /donor/profile`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "_id": "6a06ea9888988a725cb260f0",
    "id": "6a06ea9888988a725cb260f0",
    "fullName": "Ziyad Sobhy",
    "email": "cairo.responder@lifelink.demo",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-05-15T19:32:56.422Z",
    "role": "donor",
    "isSuspended": false,
    "suspendedAt": null,
    "suspendedReason": null,
    "deletedAt": null,
    "fcmTokens": [
      "f2d2tGOHRaWsSFK79-3hAt..."
    ],
    "phone": null,
    "address": null,
    "__t": "donor",
    "phoneNumber": "01141935341",
    "bloodType": "O+",
    "dateOfBirth": "1995-05-15T00:00:00.000Z",
    "gender": "male",
    "weight": 60,
    "hemoglobinLevel": 14.2,
    "temporaryDeferralUntil": null,
    "lastDeferralReason": null,
    "isAvailable": true,
    "travelHistory": [],
    "createdAt": "2026-05-15T09:42:48.347Z",
    "updatedAt": "2026-05-23T22:22:13.001Z",
    "fullNameNormalized": "ziyad sobhy",
    "__v": 1,
    "isBanned": false,
    "availableToDonate": true,
    "isVerified": true,
    "verificationStatus": "verified",
    "age": 31,
    "currentBadge": null,
    "nextBadge": "First Timer",
    "progressPercentage": 0,
    "stats": {
      "totalDonations": 5,
      "points": 0,
      "livesSaved": 15
    },
    "badgeProgress": {
      "currentBadge": null,
      "nextBadge": "First Timer",
      "progressPercentage": 0
    },
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      }
    },
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    },
    "healthHistory": {
      "chronicConditions": [],
      "medications": [],
      "allergies": [],
      "recentIllness": "",
      "notes": "Nearby emergency responder for Cairo Care Hospital.",
      "lastCheckupDate": "2026-05-03T07:00:00.000Z",
      "updatedAt": "2026-05-15T19:32:56.422Z"
    }
  }
}
```

### Consumed By

* **Model(s):** [EditProfileModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart#L28), [BadgeProgress](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart#L346), [Stats](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart#L385), [Location](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart#L448), [Coordinates](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart#L482), [Settings](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart#L506), [HealthHistory](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/model/edit_profile_model.dart#L538)
* **DataSource(s):** [EditProfileApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/data_source/edit_profile_api_data_source.dart)
* **Repository(s):** [EditProfileRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/presentation/view/edit_profile/data/repositories/edit_profile_repositories_imp.dart)
* **Screen(s):** [edit_profile_dialog.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/hospital/tabs/profile/widgets/edit_profile_dialog.dart) / Edit Profile tab views.

---

### Endpoint

`GET /donor/profile`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "_id": "6a06ea9888988a725cb260f0",
    "id": "6a06ea9888988a725cb260f0",
    "fullName": "Ziyad Sobhy",
    "email": "cairo.responder@lifelink.demo",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-05-15T19:32:56.422Z",
    "role": "donor",
    "isSuspended": false,
    "suspendedAt": null,
    "suspendedReason": null,
    "deletedAt": null,
    "fcmTokens": [
      "f2d2tGOHRaWsSFK79-3hAt..."
    ],
    "phone": null,
    "address": null,
    "__t": "donor",
    "phoneNumber": "01141935341",
    "bloodType": "O+",
    "dateOfBirth": "1995-05-15T00:00:00.000Z",
    "gender": "male",
    "weight": 60,
    "hemoglobinLevel": 14.2,
    "temporaryDeferralUntil": null,
    "lastDeferralReason": null,
    "isAvailable": true,
    "travelHistory": [],
    "createdAt": "2026-05-15T09:42:48.347Z",
    "updatedAt": "2026-05-23T22:22:13.001Z",
    "fullNameNormalized": "ziyad sobhy",
    "__v": 1,
    "isBanned": false,
    "availableToDonate": true,
    "isVerified": true,
    "verificationStatus": "verified",
    "age": 31,
    "currentBadge": null,
    "nextBadge": "First Timer",
    "progressPercentage": 0,
    "stats": {
      "totalDonations": 5,
      "points": 0,
      "livesSaved": 15
    },
    "badgeProgress": {
      "currentBadge": null,
      "nextBadge": "First Timer",
      "progressPercentage": 0
    },
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      }
    },
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    },
    "healthHistory": {
      "chronicConditions": [],
      "medications": [],
      "allergies": [],
      "recentIllness": "",
      "notes": "Nearby emergency responder for Cairo Care Hospital.",
      "lastCheckupDate": "2026-05-03T07:00:00.000Z",
      "updatedAt": "2026-05-15T19:32:56.422Z"
    }
  }
}
```

### Consumed By

* **Model(s):** [ProfileModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/model/profile/profile_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/model/profile/profile_model.dart#L70)
* **DataSource(s):** [ProfileApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/data_source/remote/profile/profile_api_data_source.dart)
* **Repository(s):** [ProfileRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/repositories/profile/profile_repositories_imp.dart)
* **Screen(s):** [profile.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/profile.dart)

---

### Endpoint

`GET /donor/settings`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    }
  }
}
```

### Consumed By

* **Model(s):** [SettingModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/model/setting/setting_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/model/setting/setting_model.dart#L29), [Settings](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/model/setting/setting_model.dart#L53)
* **DataSource(s):** [SettingApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/data_source/remote/setting/setting_api_data_source.dart)
* **Repository(s):** [SettingRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/repositories/setting/setting_repositories_imp.dart)
* **Screen(s):** [profile.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/profile.dart) (Notification Preferences and Security dialogs)

---

### Endpoint

`PUT /donor/settings`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    }
  }
}
```

### Consumed By

* **Model(s):** [SettingModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/model/setting/setting_model.dart)
* **DataSource(s):** [SettingApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/data_source/remote/setting/setting_api_data_source.dart)
* **Repository(s):** [SettingRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/repositories/setting/setting_repositories_imp.dart)
* **Screen(s):** [profile.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/profile.dart)

---

### Endpoint

`POST /auth/fcm-token`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "fcmToken": "111111111111111111",
    "tokenCount": 1
  }
}
```

### Consumed By

* **Model(s):** [FcmModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/fcm/fcm_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/fcm/fcm_model.dart#L30)
* **DataSource(s):** [FcmApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/data_source/fcm/fcm_api_data_source.dart)
* **Repository(s):** [FcmRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/repositories/fcm/fcm_repositories_imp.dart)
* **Screen(s):** Global state handling / launch initialization context.

---

### Endpoint

`GET /notifications`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "69fe540565ff7785a0313170",
        "userId": "69f3df915f42685cbbbcbb18",
        "type": "emergency",
        "title": "Emergency blood request near you",
        "message": "A hospital near you needs O+ blood for an urgent request. Tap to view details.",
        "read": false,
        "relatedId": "69fe540565ff7785a031314f",
        "relatedType": "Request",
        "data": {
          "requestId": "69fe540565ff7785a031314f",
          "hospitalName": "Cairo Care Hospital",
          "requestType": "blood"
        },
        "createdAt": "2026-05-16T13:24:00.000Z",
        "updatedAt": "2026-05-16T13:24:00.000Z"
      }
    ],
    "unreadCount": 3,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "pages": 3
    }
  }
}
```

### Consumed By

* **Model(s):** [NotificationsModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/notification/notifications_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/notification/notifications_model.dart#L36), [Notifications](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/notification/notifications_model.dart#L116), [NotificationData](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/notification/notifications_model.dart#L179), [Pagination](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/notification/notifications_model.dart#L75)
* **DataSource(s):** [NotificationApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/data_source/notification/remote/notification_api_data_source.dart)
* **Repository(s):** [NotificationRepositoryImpl](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/repositories/notification/notification_repository_impl.dart)
* **Screen(s):** [notifications.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/notifications.dart)

---

### Endpoint

`PATCH /notifications/read-all`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Notifications marked as read successfully",
  "data": {
    "notifications": [],
    "unreadCount": 0,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "pages": 0
    }
  }
}
```

### Consumed By

* **Model(s):** [NotificationsModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/models/notification/notifications_model.dart)
* **DataSource(s):** [NotificationApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/data_source/notification/remote/notification_api_data_source.dart)
* **Repository(s):** [NotificationRepositoryImpl](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/repositories/notification/notification_repository_impl.dart)
* **Screen(s):** [notifications.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/notifications.dart)

---

### Endpoint

`DELETE /notifications`

### Flutter Expected Response

*(Returns no parsed JSON body)*
```json
{}
```

### Consumed By

* **Model(s):** None (Void)
* **DataSource(s):** [NotificationApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/data_source/notification/remote/notification_api_data_source.dart)
* **Repository(s):** [NotificationRepositoryImpl](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/data/repositories/notification/notification_repository_impl.dart)
* **Screen(s):** [notifications.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/notifications/notifications.dart)

---

### Endpoint

`GET /requests/nearby`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Nearby requests retrieved successfully",
  "data": {
    "requests": [
      {
        "id": "6a130e83f9830f9b4aeb149d",
        "requestId": "6a130e83f9830f9b4aeb149d",
        "bloodType": [
          "O+",
          "A+"
        ],
        "bloodTypeLabel": "O+, A+",
        "hospitalName": "Cairo Care Hospital",
        "patientType": "Emergency blood loss response - critical responder match",
        "contactNumber": "1044444444",
        "unitsNeeded": 2,
        "isEmergency": true,
        "createdAt": "2026-05-24T14:43:15.108Z",
        "status": "pending",
        "requestStatus": "pending",
        "urgency": "critical",
        "type": "blood",
        "requiredBy": "2026-05-31T07:00:00.000Z",
        "locationHospital": {
          "latitude": 30.0511,
          "longitude": 31.2435
        },
        "location": {
          "lat": 30.0511,
          "lng": 31.2435
        },
        "qrToken": null,
        "qrCreatedAt": null,
        "qrExpiresAt": null,
        "hospital": {
          "id": "6a130e820b339a45a51addb4",
          "name": "Cairo Care Hospital",
          "contactNumber": "1044444444",
          "latitude": 30.0511,
          "longitude": 31.2435,
          "address": {
            "city": "Cairo",
            "governorate": "Cairo",
            "district": "Garden City"
          }
        },
        "distanceKm": 0.0,
        "distanceMeters": 0.0,
        "distance": "0 m"
      }
    ],
    "pagination": {
      "total": 4,
      "page": 1,
      "currentPage": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    },
    "viewerLocation": {
      "latitude": 30.0511,
      "longitude": 31.2435
    },
    "radiusKm": 25
  }
}
```

### Consumed By

* **Model(s):** [RequestsModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L37), [Requests](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L175), [Hospital](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L298), [Address](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L341), [Location](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L369), [LocationHospital](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L393), [Pagination](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L109), [ViewerLocation](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L80)
* **DataSource(s):** [RequestsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/data_source/requests/requests_api_data_source.dart)
* **Repository(s):** [RequestsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/repositories/requests/requests_repositories_imp.dart)
* **Screen(s):** [home.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/home.dart)

---

### Endpoint

`POST /donor/respond/:requestId`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Response submitted successfully",
  "data": {
    "donorId": "6a135b739b8ee66bb0201e26",
    "appointmentId": null,
    "requestId": "6a130e83f9830f9b4aeb149d",
    "status": "pending",
    "quantity": 3,
    "unitsCollected": null,
    "hemoglobinLevel": null,
    "weight": null,
    "verifiedAt": null,
    "qrToken": null,
    "qrExpires": null,
    "_id": "6a1b1f26b61716677456fc66",
    "createdAt": "2026-05-30T17:32:22.080Z",
    "updatedAt": "2026-05-30T17:32:22.080Z",
    "__v": 0
  }
}
```

### Consumed By

* **Model(s):** [RequestAcceptModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/request_accept_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/request_accept_model.dart#L48)
* **DataSource(s):** [RequestsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/data_source/requests/requests_api_data_source.dart)
* **Repository(s):** [RequestsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/repositories/requests/requests_repositories_imp.dart)
* **Screen(s):** [home.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/home.dart) (EmergencyRequestDialog/ViewDetailDialog responses)

---

### Endpoint

`POST /requests/:requestId/cancel`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "donor": {
      "id": "69f3df915f42685cbbbcbb18",
      "name": "Aya Hassan",
      "phoneNumber": "01011111111",
      "bloodType": "O+"
    },
    "request": {
      "id": "6a07521ef89827b0ef07e126",
      "requestId": "6a07521ef89827b0ef07e126",
      "bloodType": "O+",
      "hospitalName": "General Test Hospital",
      "patientType": null,
      "contactNumber": "2000000000",
      "unitsNeeded": 1,
      "isEmergency": false,
      "createdAt": "2026-05-15T17:04:30.994Z",
      "status": "cancelled",
      "requestStatus": "cancelled",
      "urgency": "high",
      "type": "blood",
      "requiredBy": "2026-05-18T17:04:30.993Z",
      "locationHospital": {
        "latitude": 30.0444,
        "longitude": 31.2357
      },
      "googleMapsUrl": "https://www.google.com/maps/dir/?api=1&destination=30.0444,31.2357",
      "qrToken": null,
      "qrCreatedAt": null,
      "qrExpiresAt": null,
      "hospital": {
        "id": "6a07521ef89827b0ef07e125",
        "name": "General Test Hospital",
        "contactNumber": "2000000000",
        "latitude": 30.0444,
        "longitude": 31.2357,
        "address": {
          "city": "Test City",
          "governorate": "Test Governorate"
        }
      },
      "distanceKm": null,
      "distanceMeters": null,
      "distance": null
    }
  }
}
```

### Consumed By

* **Model(s):** [RequestCancelModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/request_cancel_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/request_cancel_model.dart#L30), [Donor](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/request_cancel_model.dart#L60), [Request](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/request_cancel_model.dart#L113)
* **DataSource(s):** [RequestsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/data_source/requests/requests_api_data_source.dart)
* **Repository(s):** [RequestsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/repositories/requests/requests_repositories_imp.dart)
* **Screen(s):** [home.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/home.dart)

---

### Endpoint

`GET /requests/:requestId`

### Flutter Expected Response

*(Expected root entity parsing without envelope)*
```json
{
  "id": "6a130e83f9830f9b4aeb149d",
  "requestId": "6a130e83f9830f9b4aeb149d",
  "bloodType": [
    "O+",
    "A+"
  ],
  "bloodTypeLabel": "O+, A+",
  "hospitalName": "Cairo Care Hospital",
  "patientType": "Emergency blood loss response - critical responder match",
  "contactNumber": "1044444444",
  "unitsNeeded": 2,
  "isEmergency": true,
  "createdAt": "2026-05-24T14:43:15.108Z",
  "status": "pending",
  "requestStatus": "pending",
  "urgency": "critical",
  "type": "blood",
  "requiredBy": "2026-05-31T07:00:00.000Z",
  "locationHospital": {
    "latitude": 30.0511,
    "longitude": 31.2435
  },
  "location": {
    "lat": 30.0511,
    "lng": 31.2435
  },
  "qrToken": null,
  "qrCreatedAt": null,
  "qrExpiresAt": null,
  "hospital": {
    "id": "6a130e820b339a45a51addb4",
    "name": "Cairo Care Hospital",
    "contactNumber": "1044444444",
    "latitude": 30.0511,
    "longitude": 31.2435,
    "address": {
      "city": "Cairo",
      "governorate": "Cairo",
      "district": "Garden City"
    }
  },
  "distanceKm": 0.0,
  "distanceMeters": 0.0,
  "distance": "0 m"
}
```

### Consumed By

* **Model(s):** [Requests](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/requests/requests_model.dart#L175)
* **DataSource(s):** [RequestsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/data_source/requests/requests_api_data_source.dart)
* **Repository(s):** [RequestsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/repositories/requests/requests_repositories_imp.dart)
* **Screen(s):** [request_screen](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/request_screen) directory views.

---

### Endpoint

`GET /donor/stats`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "totalDonations": 0,
    "points": 0,
    "livesSaved": 0
  }
}
```

### Consumed By

* **Model(s):** [DonorStateModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/donor_states/donor_state_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/donor_states/donor_state_model.dart#L31)
* **DataSource(s):** [ApiDonorStatesDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/data_source/donor_states/remote/api_donor_states_data_source.dart)
* **Repository(s):** [DonorStatesRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/repositories/donor_states/donor_states_repositories_imp.dart)
* **Screen(s):** [home.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/home.dart) (Stats Dashboard cards)

---

### Endpoint

`GET /donor/activity`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "69fe540765ff7785a031316b",
        "title": "Blood Donation Completed",
        "hospital": "Cairo Care Hospital",
        "points": 200,
        "createdAt": "2026-05-08T21:22:16.519Z",
        "relativeTime": "2 days ago",
        "type": "donation",
        "status": "success",
        "icon": "heart"
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 10,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Consumed By

* **Model(s):** [ActivitiesModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/activities/activities_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/activities/activities_model.dart#L30), [Activities](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/activities/activities_model.dart#L114), [Pagination](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/activities/activities_model.dart#L67)
* **DataSource(s):** [ActivitiesApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/data_source/activities/activities_api_data_source.dart)
* **Repository(s):** [ActivitiesRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/repositories/activities/activities_repositories_imp.dart)
* **Screen(s):** [home.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/home.dart) (Recent activities dashboard card)

---

### Endpoint

`GET /donor/donation-eligibility`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Eligibility result",
  "data": {
    "isEligible": true,
    "reason": null,
    "nextEligibleDate": null,
    "participationEnabled": true,
    "lastDonationDate": "2026-05-10T00:00:00.000Z",
    "cooldownDays": 56,
    "daysRemaining": 0
  }
}
```

### Consumed By

* **Model(s):** [DonationEligibilityModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/donation_eligibility/donation_eligibility_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/model/donation_eligibility/donation_eligibility_model.dart#L40)
* **DataSource(s):** [DonationEligibilityApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/data_source/donation_eligibility/donation_eligibility_api_data_source.dart)
* **Repository(s):** [DonationEligibilityRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/data/repositories/donation_eligibility/donation_eligibility_repositories_imp.dart)
* **Screen(s):** [home.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/home/home.dart)

---

### Endpoint

`POST /auth/change-password`

### Flutter Expected Response

```json
{
  "success": true,
  "data": "Password changed successfully"
}
```

### Consumed By

* **Model(s):** [ChangePasswordModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/model/change_password/change_password_model.dart)
* **DataSource(s):** [ChangePasswordApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/data_source/remote/change_password/change_password_api_data_source.dart)
* **Repository(s):** [ChangePasswordRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/data/repositories/change_password/change_password_repositories_imp.dart)
* **Screen(s):** [profile.dart](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/profile/profile.dart) (SecuritySettingsDialog)

---

### Endpoint

`GET /donor/history`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "donations": [
      {
        "_id": "6a089dc87696fa4f13219a99",
        "donorId": "6a06ea9888988a725cb260f0",
        "status": "pending",
        "quantity": 3,
        "qrToken": null,
        "qrExpires": null,
        "createdAt": "2026-05-16T16:39:36.046Z",
        "updatedAt": "2026-05-16T16:39:36.046Z",
        "__v": 0,
        "pointsEarned": 0,
        "requestId": {
          "_id": "6a07107034afd013dea938b8",
          "type": "blood",
          "bloodType": "O+",
          "urgency": "critical",
          "hospitalId": {
            "_id": "69f3df915f42685cbbbcbb1b",
            "fullName": "Cairo Care Operations",
            "__t": "hospital",
            "hospitalName": "Cairo Care Hospital",
            "address": {
              "city": "Cairo",
              "governorate": "Cairo",
              "district": "Garden City"
            }
          }
        }
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Consumed By

* **Model(s):** [DonationHistoryModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history/data/model/donation_history_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history/data/model/donation_history_model.dart#L30), [Donations](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history/data/model/donation_history_model.dart#L116), [RequestId](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history/data/model/donation_history_model.dart#L181), [Pagination](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history/data/model/donation_history_model.dart#L67)
* **DataSource(s):** [DonationHistoryApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history/data/data_source/donation_history_api_data_source.dart)
* **Repository(s):** [DonationHistoryRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history/data/repositories/donation_history_repositories_imp.dart)
* **Screen(s):** [donation_history](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donation_history) directory views.

---

### Endpoint

`GET /donations/book-appointment/available-slots`

### Flutter Expected Response

*(Supports both array of timeSlot details and simple time strings)*
```json
{
  "success": true,
  "data": {
    "timeSlots": [
      {
        "time": "09:00 AM",
        "remainingCapacity": 5,
        "maxCapacity": 5
      },
      {
        "time": "10:00 AM",
        "remainingCapacity": 3,
        "maxCapacity": 5
      }
    ],
    "hospitalId": "69f3df915f42685cbbbcbb1b",
    "date": "2026-05-12T00:00:00.000Z",
    "slotsPerHour": 5
  }
}
```

### Consumed By

* **Model(s):** [TimeSlotsModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/schedule_donation/data/models/time_slots/time_slots_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/schedule_donation/data/models/time_slots/time_slots_model.dart#L33), [TimeSlotDetail](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/schedule_donation/data/models/time_slots/time_slots_model.dart#L87)
* **DataSource(s):** [TimeSlotsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/schedule_donation/data/data_source/time_slots/time_slots_api_data_source.dart)
* **Repository(s):** [TimeSlotsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/schedule_donation/data/repositories/time_slots/time_slots_repositories_imp.dart)
* **Screen(s):** [schedule_donation](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/schedule_donation) views.

---

### Endpoint

`GET /donations/book-appointment/my-appointments`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "_id": "69fe540565ff7785a031315b",
        "notes": "[demo-seed] appointment-aya-urgent",
        "donorId": "69f3df915f42685cbbbcbb18",
        "__v": 0,
        "appointmentDate": "2026-05-12T07:00:00.000Z",
        "cancelledAt": null,
        "createdAt": "2026-05-08T21:22:14.466Z",
        "donationType": "Whole Blood",
        "qrExpiresAt": "2026-05-13T07:00:00.000Z",
        "qrScannedAt": null,
        "qrToken": "demo-qr-aya-critical",
        "requestId": "69fe540565ff7785a031314f",
        "status": "pending",
        "updatedAt": "2026-05-08T21:33:29.691Z",
        "hospitalId": {
          "_id": "69f3df915f42685cbbbcbb1b",
          "fullName": "Cairo Care Operations",
          "__t": "hospital",
          "hospitalName": "Cairo Care Hospital",
          "contactNumber": "1044444444",
          "address": {
            "city": "Cairo",
            "governorate": "Cairo",
            "district": "Garden City"
          },
          "location": {
            "city": "Cairo",
            "governorate": "Cairo",
            "lastUpdated": "2026-05-08T21:33:23.752Z",
            "coordinates": {
              "lat": 30.0511,
              "lng": 31.2435
            }
          }
        }
      }
    ],
    "total": 2,
    "meta": {
      "total": 2,
      "page": 0,
      "limit": 10,
      "totalPages": 1,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Consumed By

* **Model(s):** [AppointmentModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart#L31), [Meta](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart#L72), [Appointments](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart#L125), [HospitalId](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart#L208), [Address](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart#L257), [Location](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart#L287), [Coordinates](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_model.dart#L321)
* **DataSource(s):** [AppointmentsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/data_source/appointments_api_data_source.dart)
* **Repository(s):** [AppointmentsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/repositories/appointments_repositories_imp.dart)
* **Screen(s):** [donate](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate) directory views.

---

### Endpoint

`POST /donations/book-appointment`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Appointment booked",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "status": "pending",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
    "qrExpiresAt": "2026-05-13T10:00:00.000Z",
    "notes": "First-time donor, available in the morning.",
    "donationType": "Whole Blood",
    "requestId": null,
    "donorId": {
      "_id": "69f3df915f42685cbbbcbb18",
      "fullName": "Noor Ahmed",
      "phoneNumber": "01123456789",
      "bloodType": "O+",
      "email": "noor.ahmed@example.com"
    },
    "donorDetails": {
      "fullName": "Noor Ahmed",
      "phoneNumber": "01123456789",
      "bloodType": "O+",
      "email": "noor.ahmed@example.com"
    },
    "hospitalId": {
      "_id": "69f3df915f42685cbbbcbb1b",
      "hospitalName": "Cairo Care Hospital",
      "fullName": "Cairo Care Operations"
    }
  }
}
```

### Consumed By

* **Model(s):** [BookAppointmentModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/book_appointment_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/book_appointment_model.dart#L44), [HospitalId](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/book_appointment_model.dart#L111), [DonorDetails](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/book_appointment_model.dart#L141), [DonorId](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/book_appointment_model.dart#L176)
* **DataSource(s):** [AppointmentsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/data_source/appointments_api_data_source.dart)
* **Repository(s):** [AppointmentsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/repositories/appointments_repositories_imp.dart)
* **Screen(s):** [schedule_donation](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/schedule_donation) views.

---

### Endpoint

`DELETE /donations/book-appointment/:appointmentId`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Appointment cancelled",
  "data": {
    "_id": "69fe540565ff7785a031315c",
    "donorId": "69f3df915f42685cbbbcbb18",
    "hospitalId": "69f3df915f42685cbbbcbb1b",
    "requestId": "69fe540565ff7785a031314f",
    "appointmentDate": "2026-05-12T10:00:00.000Z",
    "status": "cancelled",
    "cancelledAt": "2026-05-09T10:30:00.000Z",
    "notes": "Test appointment",
    "qrToken": "8f3a4f2f6a6d4f3a9e2c1b0a7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
    "donationType": "Whole Blood"
  }
}
```

### Consumed By

* **Model(s):** [AppointmentCancelledModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_cancelled_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/model/appointment_cancelled_model.dart#L43)
* **DataSource(s):** [AppointmentsApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/data_source/appointments_api_data_source.dart)
* **Repository(s):** [AppointmentsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate/data/repositories/appointments_repositories_imp.dart)
* **Screen(s):** [donate](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/donate) directory views.

---

### Endpoint

`GET /hospitals/nearby`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Nearby hospitals retrieved successfully",
  "data": {
    "hospitals": [
      {
        "id": "69f3df915f42685cbbbcbb1b",
        "hospitalId": "69f3df915f42685cbbbcbb1b",
        "hospital_id": "69f3df915f42685cbbbcbb1b",
        "name": "Cairo Care Hospital",
        "fullName": "Cairo Care Operations",
        "phoneNumber": "1044444444",
        "contactNumber": "1044444444",
        "email": "ops@cairocare.demo",
        "hospitalType": "General Hospital",
        "workingHours": "9AM - 5PM",
        "bloodTypes": [
          "O+",
          "A-"
        ],
        "isAvailable": true,
        "urgentNeedsCount": 2,
        "distanceKm": 2.35,
        "distanceMeters": 2350,
        "distance": "2.35 km",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo"
        },
        "location": {
          "lat": 30.0511,
          "lng": 31.2435
        },
        "lat": 30.0511,
        "lng": 31.2435
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

### Consumed By

* **Model(s):** [NearbyHospitals](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/model/nearby_hospitals.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/model/nearby_hospitals.dart#L35), [Hospitals](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/model/nearby_hospitals.dart#L115), [Location](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/model/nearby_hospitals.dart#L213), [Address](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/model/nearby_hospitals.dart#L237), [Pagination](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/model/nearby_hospitals.dart#L69)
* **DataSource(s):** [NearbyHospitalsApiSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/data_source/nearby_hospitals_api_source.dart)
* **Repository(s):** [NearbyHospitalsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/repositories/nearby_hospitals_repositories_imp.dart)
* **Screen(s):** [find_hospital](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital) directory views.

---

### Endpoint

`GET /hospitals/search`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Nearby hospitals retrieved successfully",
  "data": {
    "hospitals": [
      {
        "id": "69f3df915f42685cbbbcbb1b",
        "hospitalId": "69f3df915f42685cbbbcbb1b",
        "hospital_id": "69f3df915f42685cbbbcbb1b",
        "name": "Cairo Care Hospital",
        "fullName": "Cairo Care Operations",
        "phoneNumber": "1044444444",
        "contactNumber": "1044444444",
        "email": "ops@cairocare.demo",
        "hospitalType": "General Hospital",
        "workingHours": "9AM - 5PM",
        "bloodTypes": [
          "O+",
          "A-"
        ],
        "isAvailable": true,
        "urgentNeedsCount": 2,
        "distanceKm": 2.35,
        "distanceMeters": 2350,
        "distance": "2.35 km",
        "address": {
          "city": "Cairo",
          "governorate": "Cairo"
        },
        "location": {
          "lat": 30.0511,
          "lng": 31.2435
        },
        "lat": 30.0511,
        "lng": 31.2435
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

### Consumed By

* **Model(s):** [NearbyHospitals](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/model/nearby_hospitals.dart)
* **DataSource(s):** [NearbyHospitalsApiSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/data_source/nearby_hospitals_api_source.dart)
* **Repository(s):** [NearbyHospitalsRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital/data/repositories/nearby_hospitals_repositories_imp.dart)
* **Screen(s):** [find_hospital](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/find_hospital) directory views.

---

### Endpoint

`POST /auth/signup`

### Flutter Expected Response

```json
{
  "success": true,
  "data": {
    "locationRequired": false,
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "verificationEmail": {
      "sent": true,
      "id": "1d75e124-d0f5-49f9-a4f7-3b4e8dcb840f"
    },
    "user": {
      "id": "6a1336a36e9541206b58505f",
      "fullName": "Aya Hassan",
      "email": "aya.hassan5555@lifelink.demo",
      "password": "$2b$10$bC1j4dy6xBWkYXq.xgBRWevwKX6TjcfcTwYSFAz/HylmvCPECHB0.",
      "passwordChangedAt": null,
      "isEmailVerified": false,
      "emailVerifiedAt": null,
      "role": "donor",
      "isSuspended": false,
      "suspendedAt": null,
      "suspendedReason": null,
      "deletedAt": null,
      "fcmTokens": [],
      "phone": null,
      "address": null,
      "__t": "donor",
      "phoneNumber": "01011111111",
      "bloodType": "O+",
      "dateOfBirth": "1995-05-15T00:00:00.000Z",
      "gender": "female",
      "weight": null,
      "hemoglobinLevel": null,
      "temporaryDeferralUntil": null,
      "lastDeferralReason": null,
      "isOptedIn": true,
      "travelHistory": [],
      "createdAt": "2026-05-24T17:34:27.741Z",
      "updatedAt": "2026-05-24T17:34:28.332Z",
      "fullNameNormalized": "aya hassan",
      "__v": 0,
      "emailVerificationOtp": "823edbac2785048f77a52c47e7016080ad137c0dcdfad2e5153203ad93e9a1f9",
      "emailVerificationOtpExpires": "2026-05-24T17:44:28.331Z",
      "isBanned": false,
      "isVerified": false,
      "location": {
        "city": "Cairo",
        "governorate": "Cairo",
        "coordinates": {
          "lat": 30.0444,
          "lng": 31.2357
        },
        "lastUpdated": "2026-05-24T17:34:27.726Z"
      },
      "settings": {
        "pushNotifications": true,
        "emergencyAlerts": true,
        "privacyMode": false,
        "language": "en"
      },
      "healthHistory": {
        "chronicConditions": [],
        "medications": [],
        "allergies": [],
        "recentIllness": "",
        "notes": "",
        "lastCheckupDate": null,
        "updatedAt": null
      }
    }
  }
}
```

### Consumed By

* **Model(s):** [SignUpModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/sign_up_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/sign_up_model.dart#L30), [VerificationEmail](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/sign_up_model.dart#L68), [Tokens](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/sign_up_model.dart#L92), [User](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/sign_up_model.dart#L152)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** signup screen views.

---

### Endpoint

`POST /auth/login`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "verified": true,
    "userId": "6a130e800b339a45a51addad",
    "user_id": "6a130e800b339a45a51addad",
    "userRole": "donor",
    "user_role": "donor",
    "userName": "Aya Hassan",
    "user_name": "Aya Hassan",
    "user": {
      "_id": "6a130e800b339a45a51addad",
      "fullName": "Aya Hassan",
      "email": "aya.hassan@lifelink.demo",
      "role": "donor",
      "isEmailVerified": true
    }
  }
}
```

### Consumed By

* **Model(s):** [LoginModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/login_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/login_model.dart#L42), [User](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/login_model.dart#L97)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** login screen views.

---

### Endpoint

`POST /auth/verify-email`

### Flutter Expected Response

```json
{
  "success": true,
  "data": "Verification code sent"
}
```

### Consumed By

* **Model(s):** [VerifyEmailModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/verify_email_model.dart)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** email verification views.

---

### Endpoint

`POST /auth/verify-email-otp`

### Flutter Expected Response

```json
{
  "success": true,
  "data": "Email verified successfully"
}
```

### Consumed By

* **Model(s):** [VerifyEmailModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/verify_email_model.dart)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** OTP verification screen.

---

### Endpoint

`POST /auth/forgot-password`

### Flutter Expected Response

```json
{
  "success": true,
  "data": "Password reset email sent"
}
```

### Consumed By

* **Model(s):** [ForgetPasswordModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/forget_password_model.dart)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** forgot password views.

---

### Endpoint

`POST /auth/verify-otp`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Password reset OTP verified successfully",
  "data": {
    "verified": true,
    "email": "aya.hassan@lifelink.demo",
    "otp": "123456"
  }
}
```

### Consumed By

* **Model(s):** [VerifyOtpModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/verify_otp_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/verify_otp_model.dart#L36)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** OTP verification screen.

---

### Endpoint

`POST /auth/reset-password`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

### Consumed By

* **Model(s):** [ResetPasswordModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/reset_password_model.dart)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** reset password views.

---

### Endpoint

`POST /auth/logout`

### Flutter Expected Response

```json
{
  "success": true,
  "data": "Logout successful"
}
```

### Consumed By

* **Model(s):** [LogOutModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/log_out_model.dart)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart)
* **Screen(s):** Profile Settings options logic.

---

### Endpoint

`GET /auth/me`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Current user fetched successfully",
  "data": {
    "_id": "6a06ea9888988a725cb260f0",
    "fullName": "Ziyad Sobhy",
    "email": "cairo.responder@lifelink.demo",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-05-15T19:32:56.422Z",
    "role": "donor",
    "isSuspended": false,
    "suspendedAt": null,
    "suspendedReason": null,
    "deletedAt": null,
    "fcmTokens": [],
    "phone": null,
    "address": null,
    "__t": "donor",
    "phoneNumber": "01141935341",
    "bloodType": "O+",
    "dateOfBirth": "1995-05-15T00:00:00.000Z",
    "gender": "male",
    "weight": 60,
    "hemoglobinLevel": 14.2,
    "temporaryDeferralUntil": null,
    "lastDeferralReason": null,
    "isAvailable": true,
    "travelHistory": [],
    "createdAt": "2026-05-15T09:42:48.347Z",
    "updatedAt": "2026-05-23T22:22:13.001Z",
    "fullNameNormalized": "ziyad sobhy",
    "__v": 1,
    "isOptedIn": true,
    "isBanned": false,
    "isVerified": true,
    "location": {
      "city": "Cairo",
      "governorate": "Cairo",
      "coordinates": {
        "lat": 30.0444,
        "lng": 31.2357
      }
    },
    "settings": {
      "pushNotifications": true,
      "emergencyAlerts": true,
      "privacyMode": false,
      "language": "en"
    },
    "healthHistory": {
      "chronicConditions": [],
      "medications": [],
      "allergies": [],
      "recentIllness": "",
      "notes": "",
      "lastCheckupDate": null,
      "updatedAt": null
    }
  }
}
```

### Consumed By

* **Model(s):** [MeModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/me_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/me_model.dart#L32), [Location](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/me_model.dart#L235), [Coordinates](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/me_model.dart#L269), [Settings](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/me_model.dart#L293), [HealthHistory](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/me_model.dart#L325)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart), [AdminAuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/data_source/remote/admin_auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart), [AdminAuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/repositories/admin_auth_repositories_imp.dart)
* **Screen(s):** Layout flow routing/initializer.

---

### Endpoint

`POST /auth/validate-token`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "is_valid": true,
    "user_role": "donor",
    "user_id": "6a130e810b339a45a51addb2",
    "role": "donor",
    "userId": "6a130e810b339a45a51addb2"
  }
}
```

### Consumed By

* **Model(s):** [ValidateTokenModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/validate_token_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/model/validate_token_model.dart#L38)
* **DataSource(s):** [AuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/data_source/remote_data_source/auth_api_data_source.dart), [AdminAuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/data_source/remote/admin_auth_api_data_source.dart)
* **Repository(s):** [AuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/donor_authentication/data/repositories/auth_repositories_imp.dart), [AdminAuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/repositories/admin_auth_repositories_imp.dart)
* **Screen(s):** App launch authentication state route checks.

---

### Endpoint

`POST /auth/admin/login`

### Flutter Expected Response

```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "66f200000000000000000001",
      "fullName": "Noura Hassan",
      "email": "admin@lifelink.demo",
      "role": "admin",
      "phone": "01099998888"
    }
  }
}
```

### Consumed By

* **Model(s):** [AdminLoginModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/model/admin_login_model.dart), [Data](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/model/admin_login_model.dart#L36), [User](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/model/admin_login_model.dart#L69)
* **DataSource(s):** [AdminAuthApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/data_source/remote/admin_auth_api_data_source.dart)
* **Repository(s):** [AdminAuthRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/authentication/admin_authentication/data/repositories/admin_auth_repositories_imp.dart)
* **Screen(s):** admin login screen.

---

### Endpoint

`POST /auth/refresh-token`

### Flutter Expected Response

*(Parsed directly in HTTP interceptor layer)*
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Consumed By

* **Model(s):** Raw Map parsed dynamically.
* **DataSource(s):** [AuthInterceptor](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/core/interceptors/auth_interceptor.dart)
* **Repository(s):** Core network interceptor.
* **Screen(s):** Globally active background refresh context on 401 exceptions.

---

### Endpoint

`POST https://donation-chatbot-1fie.onrender.com/ask`

### Flutter Expected Response

```json
{
  "answer": "التبرع بالدم هو عملية تطوعية يقوم فيها شخص سليم بالتبرع بدمه لمساعدة المرضى المحتاجين. أهلاً بك!"
}
```

### Consumed By

* **Model(s):** [AnswerModel](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/chat_bot/data/model/answer_model.dart)
* **DataSource(s):** [AskApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/chat_bot/data/data_source/ask_api_data_source.dart)
* **Repository(s):** [AskRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/chat_bot/data/repositories/ask_repositories_imp.dart)
* **Screen(s):** chatbot tab views.

---

### Endpoint

`POST https://donation-chatbot-1fie.onrender.com/chat`

### Flutter Expected Response

*(Server-Sent Events / Event Stream - stream of text chunks)*
```json
data: {"text": "الت"}
data: {"text": "بر"}
data: {"text": "ع"}
data: [DONE]
```

### Consumed By

* **Model(s):** Raw string chunks.
* **DataSource(s):** [AskApiDataSource](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/chat_bot/data/data_source/ask_api_data_source.dart)
* **Repository(s):** [AskRepositoriesImp](file:///c:/Users/ziad/Desktop/graduation%20project/flutter/blood_donation_app/lib/presentation/role/donor/tabs/chat_bot/data/repositories/ask_repositories_imp.dart)
* **Screen(s):** chatbot tab views.
