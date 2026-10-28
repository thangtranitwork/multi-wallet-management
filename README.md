# MultiWallet (v1.3.2) - Personal Finance & Multi-Source Wallet Management

A modern, offline-first mobile application built with **React Native (Expo SDK 57)**, **TypeScript**, and **Expo SQLite**, designed with a clean, tactile Neo-Brutalist design system.

MultiWallet provides complete control over personal finances, multiple wallet sources, credit cards, installments, loans, bill splitting, and spending habits with an offline-first architecture and transparent privacy controls.

---

## Core Highlights

### 1. Multi-Source Wallets, Credit Cards & Installments

- **Multi-Account Tracking**: Cash, Bank Accounts, E-Wallets (MoMo, ZaloPay), Savings funds, and Credit Cards / SPayLater.
- **Credit Card Billing Cycles**: Configurable monthly statement closing and payment due dates with automated repayment scheduling.
- **Installment Engine**: Single-period deferral or multi-term installments with fee support, historical settled term imports, and 1-tap debt repayment transfers.
- **Smart Balance Adjustments**: Direct wallet balance reconciliation with optional inclusion in monthly statistics.

### 2. Debt Ledger, Smart VietQR & Invoicing

- **Receivables & Payables**: Comprehensive tracking of lending and borrowing records with contact linkage and overdue alerts.
- **Full-Width Pure VietQR (`qr_only`)**: Generates border-to-border, clean QR codes with recipient badge name and exact amount on the same line directly above the QR.
- **Debt Invoicing & Consolidated Bills**: Export and print rich invoices for debts with itemized breakdown or note fallback (`item x 1`). Seamlessly consolidates multiple debts for the same person into a single bill with 1 combined QR code.
- **Manual Itemized Debts**: Support adding itemized items/dishes when recording debts manually.
- **Intelligent Receiving Wallet Fallback**: Automatically falls back to the first available bank account if the initial spending wallet lacks a QR code.

### 3. Smart Bill Splitting & VietQR Invoicing

- **Flexible Modes**: Equal split or itemized split with custom per-person item assignments and quantities.
- **Detailed Member Allocation**: Itemized breakdown for every member (including self proxy/payer).
- **Pay on Behalf Mode (0d Self-Expense)**: Option to act as paying proxy where 100% of the bill is distributed to friends with 0d personal expense.
- **Round-Up Support & 1k Preset**: Allows rounding up split amounts (e.g. 25,432d to 26,000d) with surplus credit tracking and a 1-tap 1,000d round-up button.
- **Fee & Discount Allocation**: Proportional or equal headcount distribution of delivery fees, service charges, and promo vouchers.
- **Personalized Invoicing**: Printable and shareable digital receipts (Modern, Itemized, Minimal, Text) via PDF or high-resolution image snapshots.

### 4. Gemini AI Financial Copilot & Vision Scanner

- **Multimodal Bill & Receipt OCR**: Extracts line items, unit prices, shipping fees, service charges, discounts, and group member orders (ShopeeFood, GrabFood).
- **Conversational Financial Copilot**: Supports multi-turn dialogue, voice input (Vietnamese TTS/STT), quick balance adjustments, batch transaction logging, and financial Q&A.
- **Smart Payee Mapping**: Automatically learns recipient names and bank accounts to auto-fill transaction notes and categories on repeat transfers.
- **Cross-App Share Intent**: Share payment receipts or screenshots directly from banking apps into MultiWallet to trigger instant OCR logging.

### 5. Security & Privacy Architecture

- **Offline-First & Local Storage**: 100% of financial transactions, wallets, balances, and debts are stored strictly on-device in SQLite.
- **Salted PIN Hashing & Biometrics**: PIN codes are hashed using salted SHA-256 with constant-time verification. Support for hardware fingerprint biometrics with secure overlay protection.
- **Encrypted Credentials**: Cloud tokens and API keys are protected; sensitive values are automatically redacted from error logs.
- **Transparent Cloud Integrations (Optional)**:
  - *Google Drive*: Private OAuth backup to user's Google Drive app data storage with encrypted tokens and automatic refresh.
  - *Google Gemini AI*: Calls Gemini API with the receipt image or text prompt only when OCR or Copilot is actively used.
  - *Cloudinary*: Optional receipt image hosting offloading configured directly by the user.
- **Android Home Widget (4x2)**: Real-time balance overview, privacy mask toggle, and 1-tap expense logging shortcuts directly on the home screen.
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
- Android Studio & Android SDK (Platform 35 / API 35) or a physical Android test device
- *Note*: Due to native modules (Android Widget, Local Authentication, Native Share Intent, and SQLite WAL mode), this app requires an **Expo Development Build (`expo-dev-client`)** or a pre-built APK. It cannot run inside standard Expo Go.

### Run Locally (Development Build)

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests & type check
npm test
npm run typecheck

# 3. Generate native android project and run on device/emulator
npx expo run:android
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
