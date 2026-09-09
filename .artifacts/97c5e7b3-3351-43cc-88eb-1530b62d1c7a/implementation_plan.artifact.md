# Final Release Build Configuration

This plan covers the final optimization and build of the signed App Bundle (.aab) using your new upload key.

## Proposed Changes

### 1. Build Optimization
For a production-ready release, I recommend enabling code shrinking (R8) to reduce the app size and improve security.

#### [MODIFY] [build.gradle](file:///C:/Users/DELL/Desktop/clean-bustracker/CleanOrbit-Tracking/android/app/build.gradle)
- Set `minifyEnabled true` in the release build type.

---

### 2. Versioning (User Choice)
If this is a new release to the Play Store, you should increment the `versionCode` and potentially the `versionName`.

**Current:**
- `versionCode 1`
- `versionName "1.0"`

**Suggested:**
- `versionCode 2` (or higher if previously uploaded)
- `versionName "1.0.1"` (or your preferred versioning scheme)

---

### 3. Build & Verification
- Perform a clean build using the `upload-key.keystore`.
- Verify the final .aab file location and signing fingerprint.

## Open Questions

> [!IMPORTANT]
> 1. Would you like me to increment the `versionCode` and `versionName` for this final build?
> 2. Should I enable `minifyEnabled true` for better production performance and security?

## Verification Plan

### Automated Tests
- Run `gradlew clean :app:bundleRelease` to ensure a fresh, signed build.

### Manual Verification
- Verify the .aab file exists at `android/app/build/outputs/bundle/release/app-release.aab`.
