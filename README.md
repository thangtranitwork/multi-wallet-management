# MultiWallet (v1.2.9) - Personal Finance & Multi-Source Wallet Management

A modern, offline-first mobile application built with **React Native (Expo SDK 57)**, **TypeScript**, and **Expo SQLite**, designed with a clean, tactile Neo-Brutalist design system.

MultiWallet provides complete control over personal finances, multiple wallet sources, credit cards, installments, loans, bill splitting, and spending habits with 100% on-device privacy.

---

## Core Highlights

### 1. Multi-Source Wallets, Credit Cards & Installments
- **Multi-Account Tracking**: Cash, Bank Accounts, E-Wallets (MoMo, ZaloPay), Savings funds, and Credit Cards / SPayLater.
- **Credit Card Billing Cycles**: Configurable monthly statement closing and payment due dates with automated repayment scheduling.
- **Installment Engine**: Single-period deferral or multi-term installments with fee support, historical settled term imports, and 1-tap debt repayment transfers.
- **Smart Balance Adjustments**: Direct wallet balance reconciliation with optional inclusion in monthly statistics.

### 2. Debt Ledger & Smart VietQR Collection
- **Receivables & Payables**: Comprehensive tracking of lending and borrowing records with contact linkage and overdue alerts.
- **1-Tap Dynamic VietQR**: Generates instant NAPAS-standard QR codes with recipient bank details, exact amounts, and automated transfer notes.
- **Intelligent Receiving Wallet Fallback**: Automatically falls back to the first available bank account if the initial spending wallet lacks a QR code.

### 3. Smart Bill Splitting & VietQR Invoicing
- **Flexible Modes**: Equal split or itemized split with custom per-person item assignments and quantities.
- **Pay on Behalf Mode (0d Self-Expense)**: Option to act as paying proxy where 100% of the bill is distributed to friends with 0d personal expense.
- **Round-Up Support & 1k Preset**: Allows rounding up split amounts (e.g. 25,432d to 26,000d) with surplus credit tracking and a 1-tap 1,000d round-up button.
- **Fee & Discount Allocation**: Proportional or equal headcount distribution of delivery fees, service charges, and promo vouchers.
- **Personalized Invoicing**: Printable and shareable digital receipts (Modern, Itemized, Minimal, Text) via PDF or high-resolution image snapshots.

### 4. Gemini AI Financial Copilot & Vision Scanner
- **Multimodal Bill & Receipt OCR**: Extracts line items, unit prices, shipping fees, service charges, discounts, and group member orders (ShopeeFood, GrabFood).
- **Conversational Financial Copilot**: Supports multi-turn dialogue, voice input (Vietnamese TTS/STT), quick balance adjustments, batch transaction logging, and financial Q&A.
- **Smart Payee Mapping**: Automatically learns recipient names and bank accounts to auto-fill transaction notes and categories on repeat transfers.
- **Cross-App Share Intent**: Share payment receipts or screenshots directly from banking apps into MultiWallet to trigger instant OCR logging.

### 5. Security, Cloud Sync & Android Widget
- **Biometric & PIN Lock**: Fingerprint unlock and on-screen PIN keypad with smart media picker bypass.
- **Android Home Widget (4x2)**: Real-time balance overview, privacy mask toggle, and 1-tap expense logging shortcuts directly on the home screen.
- **Automated Backup & Cloud Sync**: Local JSON export/import, Google Drive OAuth cloud backup, and direct Cloudinary image offloading.
- **Offline Habit Reminders**: Local notification engine detecting routine spending patterns with smart absence suppression.

---

## Technology Stack

- **Framework**: React Native 0.86, Expo SDK 57 (New Architecture enabled)
- **Language**: TypeScript 6.0
- **Database**: Expo SQLite (WAL mode, foreign keys enforced)
- **State Management**: React Context + SQLite atomic transactions
- **AI & Vision**: Google Gemini 2.0 Flash Multimodal API
- **Widgets & Notifications**: react-native-android-widget, expo-notifications
- **Media & Audio**: expo-audio, expo-speech, expo-camera, expo-image-picker
- **Design System**: Tactile Neo-Brutalism (high-contrast borders, bold typography, pastel accents)

---

## Getting Started

### Prerequisites
- Node.js 20+
- Expo Go on Android or iOS

### Run Locally
```bash
# 1. Install dependencies
npm install

# 2. Start Expo development server
npx expo start
```

### Build Android APK

- **GitHub Actions (Recommended)**: Use `.github/workflows/build-apk.yml` to build release APKs in ~4 minutes.
- **EAS Local Build**:
  ```bash
  npx eas build -p android --profile preview --local
  ```
- **Native Gradle Build**:
  ```bash
  npx expo prebuild -p android
  cd android && ./gradlew assembleRelease
  ```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
