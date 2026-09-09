# MultiWallet - Personal Finance & Multi-Source Wallet Management

A modern, high-performance mobile application built with **React Native (Expo SDK 57)**, **TypeScript**, and **Expo SQLite**, crafted with a distinctive, tactile Neo-Brutalist design language. 

Designed for 100% offline-first privacy, MultiWallet gives you total control over all your money sources, loans, expenses, and net worth without relying on any external cloud database.

---

## 🌟 Key Features

### 1. Multi-Source Wallet Management
- Seamlessly track multiple financial accounts in one place:
  - **Cash**: Daily pockets and cash expenses.
  - **Bank Accounts**: Multiple checking and saving accounts.
  - **E-Wallets**: Digital wallets and fintech services.
  - **Credit Cards**: Track credit limits, current balances, and available credit automatically.
  - **Savings & Investments**: Dedicated long-term funds.
- Customizable visual tags, colors, and icons for each wallet.
- Quick **Balance Adjustment** with automatic delta logging.
- Option to exclude specific wallets from total Net Worth calculations.

### 2. Comprehensive Debt & Loan Tracker
- **Lend / Receivables (Money people owe you)**:
  - Record loans disbursed directly from any selected wallet.
  - Track remaining balances, borrower contact, and due dates with overdue notices.
  - **Partial or Full Debt Collection**: Collect repayments directly into your chosen wallet.
  - Automatically accounted as an **Asset** in Net Worth calculation.
- **Borrow / Payables (Money you owe others)**:
  - Record borrowed amounts and the destination wallet receiving the funds.
  - **Installment or Lump-sum Repayment**: Deduct payments from any wallet.
  - Automatically accounted as **Liabilities**.

### 3. Rapid Transaction Logging with Date & Time Selection
- **Expenses**: Deduct from wallet, assign category (Food & Dining, Coffee, Transport, Shopping, Bills, etc.).
- **Income**: Credit to wallet, assign category (Salary, Bonus, Investment, etc.).
- **Internal Transfers**: Transfer funds between wallets (e.g., Bank to E-Wallet) with instant two-way balance updates without affecting Net Worth.
- **Backdating & Custom Time Selection**:
  - One-tap quick presets: **Today**, **Yesterday**, **2 days ago**.
  - Interactive Neo-Brutalist calendar grid and hour/minute steppers for precise transaction backdating.
- Tactile mobile number keypad with `000` triple-zero button for effortless entry.

### 4. Financial Analytics, Cash Flow & Spending Ratio
- Standard financial formula for **Net Worth**:
  $$\text{Net Worth} = (\text{Total Available Wallet Balances} + \text{Receivables}) - (\text{Credit Card Debt} + \text{Payables})$$
- **Flexible Time Period Filter**: This Week, This Month, Last Month, This Year, All Time.
- Cash flow breakdown: Total Income, Total Expenses, Net Savings, **Savings Rate %**, and **Average Daily Spending**.
- Ratio meter comparing Income vs Expense percentages.
- Category spending distribution with interactive percentage badges and progress tracks.
- Asset allocation breakdown across multiple wallets.
- Privacy eye toggle (`👁️`) to mask sensitive figures (`••••••`) in public spaces.

### 5. Custom Category Management
- Manage Expense & Income categories with personalized naming.
- Pick from 24+ curated financial and lifestyle icons.
- Choose from 12+ vibrant Neo-Brutalist color palettes.
- Safely delete categories with automatic transaction unlinking.

### 6. Tactile Haptic Feedback (Cảm ứng xúc giác cơ học)
- Powered by `expo-haptics` with fine-tuned vibration pulses.
- Mechanical keypress feedback on the Neo-Brutalist numeric keypad (`0-9`, `000`, `⌫`).
- Distinct haptic feedback patterns for tab switching, saving transactions, and alert warnings.
- User-configurable on/off switch in Settings.

### 7. Biometric (Fingerprint) & PIN App Lock (Bảo mật sinh trắc học & Mã PIN)
- Powered by `expo-local-authentication` and SQLite local encrypted settings.
- **Fingerprint Scanner (Cảm biến vân tay)**: Fast and seamless biometric unlock.
- **4-Digit Neo-Brutalist PIN Pad**: Tactile passcode fallback with wrong-PIN shake animations.
- Auto-locks whenever the app is sent to the background or reopened.
- Configurable toggle and PIN change options in Settings.

### 8. Settings & Complete Data Backup (Import / Export)
- **Export Backup**:
  - Export all SQLite tables into a standardized JSON file.
  - Native system share sheet (AirDrop, Google Drive, Telegram, Zalo, Save to Files, etc.).
  - View & copy raw JSON directly to your clipboard.
- **Import Backup**:
  - **Replace Mode**: Safely restore all data (ideal when moving to a new phone).
  - **Merge Mode**: Combine new data without erasing existing records.
  - Pick `.json` file from device storage or paste raw JSON text.
  - Pre-import validation and confirmation dialogs to prevent accidental data loss.

---

## 🛠️ Technology Stack

- **Framework**: React Native 0.86 + Expo SDK 57 (New Architecture enabled)
- **Language**: TypeScript 6.0
- **Database**: `expo-sqlite` (WAL mode enabled, foreign keys enforced)
- **Navigation**: React Navigation v7
- **Native File APIs**: `expo-file-system`, `expo-sharing`, `expo-document-picker`
- **Date Utility**: `dayjs`
- **Design Aesthetic**: Tactile Neo-Brutalism with high-contrast borders, playful offsets, and curated palettes.

---

## 🚀 Getting Started (Run on Real Device / Simulator)

### Prerequisites
- Node.js 20+ installed
- Expo Go app on your phone (available for free on the App Store & Google Play)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npx expo start
```

### 3. Open on Device
- **Android**: Open **Expo Go**, tap **Scan QR Code**, and scan the QR code displayed in the terminal.
- **iOS (iPhone)**: Open the stock **Camera** app, scan the QR code, and tap the banner to open in Expo Go.

---

## 📱 Building Android APK

### ⚡ Option 1: Automated GitHub Actions (Recommended - 4 Minutes, 0 Queue)
This repository includes a pre-configured GitHub Actions workflow (`.github/workflows/build-apk.yml`).

1. Push this project to your GitHub repository:
   ```bash
   git remote add origin https://github.com/your-username/multi-wallet-management.git
   git push -u origin master
   ```
2. On GitHub, navigate to **Actions** > **Build Android APK**.
3. Click **Run workflow** > Select **Release** (or Debug) > Click **Run workflow**.
4. Once completed (~4 minutes), download the ready-to-install **`MultiWallet-Release-APK`** directly from the summary page!

---

### 💻 Option 2: Build Locally with EAS CLI
If your computer has the Android SDK installed:
```bash
npx eas build -p android --profile preview --local
```
The resulting `.apk` file will be generated directly in your project root.

---

### 🛠️ Option 3: Offline Native Gradle Build
```bash
# 1. Generate native Android project files
npx expo prebuild -p android

# 2. Build Release APK
cd android && ./gradlew assembleRelease

# Output location:
# android/app/build/outputs/apk/release/app-release.apk

# Install directly to connected device:
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## 📂 Project Structure

```text
├── .github/
│   └── workflows/
│       └── build-apk.yml       # Automated CI/CD GitHub Actions APK builder
├── src/
│   ├── components/             # Reusable Neo-Brutalist UI components
│   │   ├── DebtModal.tsx       # Loan creation & payment modal
│   │   ├── NeoCard.tsx         # Tactile card component
│   │   ├── NeoDropdown.tsx     # Custom dropdown selector
│   │   ├── QuickAddModal.tsx   # Transaction logger with date & time picker
│   │   ├── TransactionItem.tsx # Individual transaction card
│   │   ├── WalletCard.tsx      # Interactive wallet balance card
│   │   └── WalletModal.tsx     # Wallet creation & editing modal
│   ├── constants/              # Theme tokens, palettes & formatters
│   ├── context/
│   │   └── WalletContext.tsx   # Global state & SQLite bridge
│   ├── database/
│   │   ├── backup.ts           # JSON serialization, export & import engine
│   │   ├── db.ts               # SQLite schema & category seeds
│   │   └── queries.ts          # Optimized SQL queries & transactions
│   ├── navigation/
│   │   └── RootNavigator.tsx   # Tab navigator & route definitions
│   ├── screens/                # Core screens (Dashboard, Wallets, Debts, Transactions, Settings)
│   └── types/                  # TypeScript data interfaces
├── app.json                    # Expo configuration & plugins
├── eas.json                    # EAS build profiles
└── package.json
```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](file:///home/thang/coding/multi-wallet-management/LICENSE) for details.
