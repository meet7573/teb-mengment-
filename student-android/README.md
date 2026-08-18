# TEB Student Android App — Phase 2

This is the isolated student-only Android client for the TEB Management system.

## Scope
- Tablet ID + Student PIN activation
- Active session status
- Return tablet
- No admin portal screens
- No Supabase credentials in the APK
- Communicates only with the student session API

## Important
The app is intentionally kept separate from the existing React admin portal. Do not merge this into the production `main` branch until the API contract and real-device testing are completed.

## Build
Open `student-android` in Android Studio and run the `app` configuration on a test Android tablet/emulator.
