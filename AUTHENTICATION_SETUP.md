# Authentication Setup Guide

This guide will help you set up authentication for your Pudo Booking app.

## 1. Firebase Console Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. In the left sidebar, click on "Authentication"
4. Click on "Get started" if you haven't set up authentication yet
5. Go to the "Sign-in method" tab
6. Enable "Email/Password" authentication:
   - Click on "Email/Password"
   - Toggle the "Enable" switch
   - Click "Save"

## 2. Deploy Firestore Security Rules

1. Install Firebase CLI if you haven't already:

   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:

   ```bash
   firebase login
   ```

3. Initialize Firebase in your project (if not already done):

   ```bash
   firebase init
   ```

   - Select "Firestore" when prompted
   - Choose your project
   - Use the default file names

4. Deploy the security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## 3. Environment Variables

Make sure your `.env` file contains all the necessary Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 4. Testing the Authentication

1. Start your development server:

   ```bash
   npm run dev
   ```

2. The app will now show a login page when you first access it
3. You can either:
   - Sign up with a new email and password
   - Sign in with existing credentials

## 5. Security Rules Explanation

The current security rules (`firestore.rules`) require authentication for all database operations:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

This means:

- Only authenticated users can read or write to any document
- Unauthenticated users cannot access any data
- All existing functionality will work the same, but now requires login

## 6. Features Added

- **Login/Signup Page**: Clean Material-UI interface with tabs for sign in and sign up
- **Authentication Context**: Manages user state throughout the app
- **Protected Routes**: App content is only accessible to authenticated users
- **Sign Out**: Available in both the drawer menu and app bar
- **User Email Display**: Shows the logged-in user's email in the app bar
- **Loading States**: Proper loading indicators during authentication

## 7. Troubleshooting

### Common Issues:

1. **"Firebase: Error (auth/user-not-found)"**

   - Make sure you're using the correct email/password
   - Try signing up first if the account doesn't exist

2. **"Firebase: Error (auth/weak-password)"**

   - Password must be at least 6 characters long

3. **"Firebase: Error (auth/email-already-in-use)"**

   - The email is already registered, try signing in instead

4. **Database access denied**
   - Make sure you've deployed the security rules
   - Check that the user is properly authenticated

### Getting Help:

- Check the Firebase Console for authentication logs
- Verify your environment variables are correct
- Ensure Firebase Authentication is enabled in your project
