# Pudo Booking Desktop App

A cross-platform desktop application for managing Pudo package bookings and customers, built with Electron, React, and Firebase.

## Features

- **Customer Management**: Add, edit, and delete customers with delivery preferences (locker or address)
- **Locker Search**: Auto-complete search for Pudo lockers using the Pudo API
- **Sender Configuration**: Configure sender details for package collection
- **Bulk Booking**: Select multiple customers and create bookings with different package sizes
- **Firebase Integration**: All data stored in Firebase Firestore
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- Pudo API key

## Setup

1. **Clone and Install Dependencies**

   ```bash
   npm install
   ```

2. **Environment Configuration**

   - Copy `env.example` to `.env`
   - Fill in your Firebase configuration:
     ```
     FIREBASE_API_KEY=your-api-key
     FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
     FIREBASE_PROJECT_ID=your-project-id
     FIREBASE_MESSAGING_SENDER_ID=123456789
     FIREBASE_APP_ID=1:123456789:web:abcdef123456
     ```
   - Add your Pudo API key:
     ```
     PUDO_API_KEY=Bearer YOUR_PUDO_API_KEY_HERE
     ```

3. **Firebase Setup**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firestore Database
   - Get your web app configuration from Project Settings
   - Update the `.env` file with your Firebase config

## Development

```bash
# Start development server
npm run dev
```

This will start both the React development server and Electron in development mode.

## Building

```bash
# Build for production
npm run build

# Package for distribution
npm run dist
```

## Usage

### 1. Configure Sender Details

- Go to "Sender Details" tab
- Fill in your collection information (name, email, mobile)
- Choose between locker collection or address collection
- If using locker, search and select your collection locker

### 2. Add Customers

- Go to "Customers" tab
- Click "Add Customer" to create new customers
- Fill in customer details including delivery preferences
- For locker delivery, search and select the destination locker

### 3. Create Bookings

- Go to "Create Bookings" tab
- Select customers from the list (checkbox selection)
- Choose package size for each customer (XS, S, M, L)
- Click "Create Bookings" to process all selected customers

## Package Sizes

- **XS (Extra Small)**: Service code `L2LXS - ECO`
- **S (Small)**: Service code `L2LS - ECO`
- **M (Medium)**: Service code `L2LM - ECO`
- **L (Large)**: Service code `L2LL - ECO`

## API Integration

The app integrates with the Pudo API for:

- Searching and listing available lockers/terminals
- Creating shipments and bookings

## Data Storage

All customer data, sender information, and booking records are stored in Firebase Firestore with the following collections:

- `customers`: Customer information and delivery preferences
- `sender`: Sender configuration (single document)
- `bookings`: Booking records with Pudo references

## Troubleshooting

1. **Firebase Connection Issues**

   - Verify your Firebase configuration in `.env`
   - Check that Firestore is enabled in your Firebase project
   - Ensure your Firebase rules allow read/write access

2. **Pudo API Issues**

   - Verify your API key is correct and has proper permissions
   - Check that the API endpoints are accessible

3. **Build Issues**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check that all dependencies are properly installed

## License

MIT License
