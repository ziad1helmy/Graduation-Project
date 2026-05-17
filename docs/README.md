# LifeLink Technical Documentation Hub

Welcome to the LifeLink backend technical documentation directory. This folder contains the definitive, highly-audited artifacts detailing the system's architecture, API specifications, and Flutter integration guidelines.

## Master Documents

- **[Project Review & Technical Audit](PROJECT_REVIEW.md)**: The final forensic audit report, detailing architecture, security, test inventories (243 tests), matching algorithms, and system readiness.
- **[Flutter Integration Guide](FLUTTER_INTEGRATION.md)**: The comprehensive developer integration contract. Includes step-by-step authentication flows, route structures, and token handling for the Flutter client team.

## Flutter Feature Documentation

- **[Flutter Donation Scheduling](FLUTTER_DONATION_SCHEDULING.md)**: Complete documentation of the Schedule Donation and Reschedule Donation workflows implemented in the Flutter app. Covers all 4 steps, backend API integration, QR code handling, form validation, and project status confirmation that both features are fully implemented.
- **[Flutter Geo & Distance Integration](FLUTTER_GEO_DISTANCE.md)**: Backend review of the Haversine distance calculation (`geo.js`) plus a full Flutter integration guide — Dart models, API service, client-side Haversine mirror, GPS permission flow, and the Choose Location screen implementation.

## API Specifications

- **[OpenAPI / Swagger](../openapi.yaml)**: The primary source of truth for all API contracts. Importable to Swagger UI or code generators.
- **[Postman Collection](LifeLink-Auth-API.postman_collection.json)**: Ready-to-use Postman workspace for rapid testing.
- **[CURL Examples](CURL_EXAMPLES.sh)**: Executable shell script containing `curl` snippets for core endpoints.

*(Note: For local environment setup, architecture diagrams, and testing commands, please refer to the [Root README](../README.md).)*
