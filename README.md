# MultiWallet (v1.1.1) - Personal Finance & Multi-Source Wallet Management

A modern, high-performance mobile application built with **React Native (Expo SDK 57)**, **TypeScript**, and **Expo SQLite**, crafted with a distinctive, tactile Neo-Brutalist design language. 

Designed for 100% offline-first privacy, MultiWallet gives you total control over all your money sources, loans, expenses, and net worth without relying on any external cloud database.

---

## Key Features

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

### 4. Interactive Neo-Brutalist Home Screen Widget (Android 4x2)
- **Real-Time Financial Overview**: Total assets, monthly income, and monthly expense directly on your Android Home Screen.
- **Interactive Balance Privacy Toggle**: Tap the eye button right on the widget to toggle masking (`••••••`) without needing to launch the app.
- **Tactile 1-Tap Shortcuts**:
  - `[+]` button: Instantly launches the app directly into the quick-expense logger.
  - `[-]` button: Directly logs quick expense.
  - `[Eye]` button: Toggles privacy status immediately.
- **Automatic Instant Sync**: Automatically updates the widget whenever transactions are created, edited, deleted, or wallets are adjusted.

### 5. Smart Multi-Category Habitual Reminders (Nhắc nhở thông minh đa thói quen)
- **Universal Habit Clustering Engine**: Automatically analyzes your SQLite transaction history to discover recurring behavioral patterns across **all categories**:
  - **Morning Routine (06:00 - 10:00)**: Cà phê sáng, ăn sáng, đổ xăng đầu ngày.
  - **Lunch Routine (11:00 - 14:00)**: Cơm trưa, đồ uống trưa.
  - **Afternoon Routine (14:00 - 17:30)**: Trà chiều, cà phê chiều, ăn vặt công sở, gym / thể thao.
  - **Dinner Routine (17:30 - 21:00)**: Bữa tối, đi chợ / siêu thị, xăng xe tan tầm.
  - **Monthly Recurring Bills**: Tự động phát hiện hóa đơn điện, nước, internet, tiền nhà định kỳ theo ngày trong tháng.
  - **Daily Wrap-up (21:30)**: Chốt sổ kiểm tra chi tiêu cuối ngày.
- **100% Offline Local Notifications**: Powered by `expo-notifications`, zero cloud dependencies, complete on-device privacy.
- **Dynamic Smart Absence Check**: If you have already recorded an expense for that specific category in today's window (or paid this month's bill), the app stays completely silent.
- **Individual Habit Toggles in Settings**: View all detected habits with peak time, scheduled time, and toggle each habit on or off individually.
- **1-Tap Quick Add Execution**: Tapping any reminder opens `QuickAddModal` with the corresponding category pre-filled and numeric keypad ready.
- **Playful Vietnamese Tone (0 Emoji)**: Witty "chiếc ví bạn thân" voice lines, strictly adhering to the project 0-emoji design rule.

### 6. Financial Analytics, Cash Flow & Spending Ratio
- Standard financial formula for **Net Worth**:
  $$\text{Net Worth} = (\text{Total Available Wallet Balances} + \text{Receivables}) - (\text{Credit Card Debt} + \text{Payables})$$
- **Flexible Time Period Filter**: This Week, This Month, Last Month, This Year, All Time.
- Cash flow breakdown: Total Income, Total Expenses, Net Savings, **Savings Rate %**, and **Average Daily Spending**.
- Ratio meter comparing Income vs Expense percentages.
- Category spending distribution with interactive percentage badges and progress tracks.
- Asset allocation breakdown across multiple wallets.
- Privacy eye toggle to mask sensitive figures (`••••••`) in public spaces.

### 7. Custom Category Management
- Manage Expense & Income categories with personalized naming.
- Pick from 24+ curated financial and lifestyle icons.
- Choose from 12+ vibrant Neo-Brutalist color palettes.
- Safely delete categories with automatic transaction unlinking.

### 8. Planned Expenses & Safe-to-Spend (Kế Hoạch Dự Chi & Tiền An Toàn)
- **Schedule Upcoming Future Expenses**:
  - Plan upcoming fixed or variable expenses (house rent, electricity, tuition fees, gifts, etc.).
  - **Target Due Date (Ngày dự chi)** with intelligent relative countdown badges:
    - `Hôm nay đến hạn!` (Urgent warning)
    - `Quá hạn X ngày` (Overdue alert)
    - `Ngày mai` / `Còn X ngày` (Upcoming schedule)
    - `Đã chi` (Completed)
  - One-tap quick date chips: *Hôm nay, Ngày mai, Sau 3 ngày, 1 tuần tới, Đầu tháng tới*.
- **Safe-to-Spend Balance (Tiền có thể chi tiêu an toàn)**:
  - Real-time calculation:
    $$\text{Safe-to-Spend} = \text{Total Wallet Balances} - \text{Total Pending Planned Expenses}$$
  - Clearly displayed on both the **Dashboard Widget** and the **Planned Expenses Modal**. Know exactly how much money is safe to spend today without running out of cash for scheduled bills!
- **1-Tap "Đã Chi" Execution**:
  - Convert any planned expense into an actual expense transaction with 1 tap.
  - Choose the paying wallet, confirm or adjust the actual transacted amount, and add notes.
  - Handled atomically inside an `expo-sqlite` transaction (marks executed, updates balance, creates transaction).

### 9. Tactile Haptic Feedback (Cảm ứng xúc giác cơ học)
- Powered by `expo-haptics` with fine-tuned vibration pulses.
- Mechanical keypress feedback on the Neo-Brutalist numeric keypad (`0-9`, `000`, `⌫`).
- Distinct haptic feedback patterns for tab switching, saving transactions, and alert warnings.
- User-configurable on/off switch in Settings.

### 10. Biometric (Fingerprint) & Tactile PIN Lock (Bảo mật vân tay & Mã PIN)
- Powered by `expo-local-authentication` and SQLite local encrypted settings.
- **Fingerprint Scanner (Cảm biến vân tay)**: Fast and seamless biometric unlock.
- **Dedicated Neo-Brutalist Numeric Keypad**: 
  - Centered PIN setup modal with an on-screen tactile keypad (no soft keyboard clutter).
  - 2-step setup flow: Step 1 (Create PIN) $\to$ Step 2 (Confirm PIN).
  - Tactile indicator dots (`● ○ ○ ○`) with error shake animation (`Animated.sequence`) on mismatch.
- Auto-locks whenever the app is sent to the background or reopened.
- Configurable toggle and PIN change options in Settings.

### 11. Settings & Complete Data Backup (Import / Export)
- **Google Drive Cloud Sync**: Seamless OAuth 2.0 cloud backup to private Google Drive storage.
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

## Technology Stack

- **Framework**: React Native 0.86 + Expo SDK 57 (New Architecture enabled)
- **Language**: TypeScript 6.0
- **Database**: `expo-sqlite` (WAL mode enabled, foreign keys enforced)
- **Home Widget**: `react-native-android-widget` (Neo-brutalist interactive widget)
- **Local Notifications**: `expo-notifications` (Offline habit reminders & absence check)
- **Navigation**: React Navigation v7
- **Native File APIs**: `expo-file-system`, `expo-sharing`, `expo-document-picker`
- **Security & Biometrics**: `expo-local-authentication`, `expo-haptics`
- **Date Utility**: `dayjs`
- **Design Aesthetic**: Tactile Neo-Brutalism with high-contrast borders, playful offsets, and curated palettes.

---

## Getting Started (Run on Real Device / Simulator)

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

## Building Android APK

### Option 1: Automated GitHub Actions (Recommended - 4 Minutes, 0 Queue)
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

### Option 2: Build Locally with EAS CLI
If your computer has the Android SDK installed:
```bash
npx eas build -p android --profile preview --local
```
The resulting `.apk` file will be generated directly in your project root.

---

### Option 3: Offline Native Gradle Build
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

## Project Structure

```text
├── .github/
│   └── workflows/
│       └── build-apk.yml           # Automated CI/CD GitHub Actions APK builder
├── src/
│   ├── components/                 # Reusable Neo-Brutalist UI components
│   │   ├── CategoryManagementModal.tsx # Custom category creation & color/icon picker
│   │   ├── DebtModal.tsx           # Loan creation & payment modal
│   │   ├── LockScreenOverlay.tsx   # Biometric & PIN lock overlay
│   │   ├── NeoCard.tsx             # Tactile card component
│   │   ├── NeoDropdown.tsx         # Custom dropdown selector
│   │   ├── PlannedExpensesModal.tsx# Planned expenses & safe-to-spend manager
│   │   ├── QuickAddModal.tsx       # Transaction logger with date & time picker
│   │   ├── TransactionItem.tsx     # Individual transaction card
│   │   ├── WalletCard.tsx          # Interactive wallet balance card
│   │   └── WalletModal.tsx         # Wallet creation & editing modal
│   ├── constants/                  # Theme tokens, palettes & formatters
│   ├── context/
│   │   ├── SecurityContext.tsx     # Biometrics & PIN lock state
│   │   └── WalletContext.tsx       # Global finance state & SQLite bridge
│   ├── database/
│   │   ├── backup.ts               # JSON serialization, export & import engine
│   │   ├── db.ts                   # SQLite schema & category seeds
│   │   └── queries.ts              # Optimized SQL queries & atomic transactions
│   ├── navigation/
│   │   └── RootNavigator.tsx       # Tab navigator & notification routing
│   ├── screens/                    # Core screens (Dashboard, Analytics, Wallets, Debts, Transactions, Settings)
│   ├── services/
│   │   ├── habitNotificationService.ts # Habit learning, absence check & local notifications
│   │   ├── widgetSyncService.ts    # Android Home Widget persistent state sync
│   │   ├── googleDriveService.ts   # Google Drive OAuth & file backup API
│   │   └── predictionService.ts    # Category heuristic prediction
│   ├── widgets/
│   │   ├── WalletWidget.tsx        # Neo-brutalist Android Home Screen Widget (4x2)
│   │   └── widgetTaskHandler.tsx   # Background click & update task handler
│   ├── utils/
│   │   └── haptics.ts              # Fine-tuned vibration & haptic helpers
│   └── types/                      # TypeScript data interfaces
├── app.json                        # Expo configuration & plugins
├── eas.json                        # EAS build profiles
└── package.json
```

---

## License

This project is licensed under the MIT License. See [LICENSE](file:///home/thang/coding/multi-wallet-management/LICENSE) for details.
