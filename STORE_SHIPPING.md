# Shipping Pudo Booking to the stores

The React app is wrapped with Capacitor (`com.pudoapp.booking`). Desktop Electron builds are unchanged.

## Local mobile builds

1. Copy `config.example.json` to `config.json` with `PUBLIC_MODE: true` and the public Firebase project (`pudo-booking-pub`).
2. `npm install`
3. `npm run cap:android` or `npm run cap:ios`

Android Studio / Xcode will open. Run on a device or emulator.

## Web app (subscribers)

The same UI is hosted at `https://pudo-booking.web.app/app/` by the homepage deploy workflow. Signed-in subscribers on the homepage are sent there automatically.

Build locally:

```
node scripts/write-public-config.js
npm run build:web
```

Then from `pudo_booking_homepage`:

```
BOOKING_WEB_BUILD=../pudo_booking/build-web npm run embed-web-app
```

## App Store / Play Console (manual)

You need:

- Apple Developer Program ($99/year)
- Google Play Console ($25 one-time)
- Privacy policy URL: `https://pudo-booking.web.app/privacy/`

Before first submission:

1. Replace launcher icons (`android/app/src/main/res/mipmap-*` and the iOS AppIcon set) using `assets/icon.png`.
2. Add `pudo-booking.web.app`, `pudo-booking-pub.firebaseapp.com`, plus the iOS bundle id and Android package name, as authorized domains in Firebase Auth.
3. Restrict the Google Maps key to that website, the iOS bundle id, and the Android SHA-1.
4. Create a Play upload keystore and App Store Connect certificates/profiles. Do not commit those files.
5. Submit a signed Android App Bundle from Android Studio (`Build > Generate Signed Bundle`) and an iOS archive from Xcode (`Product > Archive`).

CI currently uploads an **unsigned Android debug APK** and compiles iOS without signing. It does not publish listings.

## Support contact

info@gengargames.com
