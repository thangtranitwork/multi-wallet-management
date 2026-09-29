# MultiWallet (v1.2.2) - Personal Finance & Multi-Source Wallet Management

A modern, high-performance mobile application built with **React Native (Expo SDK 57)**, **TypeScript**, and **Expo SQLite**, crafted with a distinctive, tactile Neo-Brutalist design language. 

Designed for 100% offline-first privacy, MultiWallet gives you total control over all your money sources, loans, expenses, credit cards, BNPL installments, and net worth without relying on any external cloud database.

---

## Key Features

### 1. Multi-Source Wallet & Credit Card Management
- Seamlessly track multiple financial accounts in one place:
  - **Cash**: Daily pockets and cash expenses.
  - **Bank Accounts**: Multiple checking and saving accounts.
  - **E-Wallets**: Digital wallets and fintech services.
  - **Credit Cards & SPayLater (Buy Now Pay Later)**:
    - Track credit limits, current balances (negative debt), and available credit in real-time.
    - **Configurable Billing Cycles**: Set monthly Statement Closing Date (`statement_day`) and Payment Due Date (`due_day`).
    - Smart due-date suggestions when logging credit card spending.
  - **Savings & Investments**: Dedicated long-term funds.
- Customizable visual tags, colors, and icons for each wallet.
- **Smart Balance Adjustment**:
  - Direct balance correction with optional **"Include in Monthly Income/Expense Reports"** toggle.
  - Exclude initial balance corrections from inflating monthly earnings/spending statistics.
- Option to exclude specific wallets from total Net Worth calculations.

### 2. Credit Card & Installment Engine (Trả Góp & Hẹn Lịch Trả Nợ)
- **Single-Period Deferral (Trả sau 1 kỳ)**:
  - Record expense on credit card/SPayLater $\rightarrow$ Available credit decreases, cash/bank wallets remain untouched.
  - Automatically schedules linked **Planned Expense** on the expected payment due date.
- **Multi-Period Installments (Trả góp nhiều kỳ)**:
  - Configurable terms (2, 3, 6, 9, 12 periods or custom).
  - **Dual Input Modes**: Enter total principal OR enter amount per term to automatically calculate initial principal.
  - **Support for Pre-existing / Already-paid Terms (Nhập số kỳ đã trả trước đó)**: Seamlessly import historical installments with $k$ terms already settled outside the app. Automatically calculates remaining debt and schedules future payments starting from term $k+1$.
  - Monthly installment fee support (fixed VND fee per period or conversion rate).
  - Interactive **Accordion Preview** avoiding scroll jumps while typing.
  - Flexible **Due Date Adjustment**: Customize due dates with stepper chips (`Chu kỳ thẻ`, `+15 ngày`, `+30 ngày`, `+45 ngày`) and edit linked installment schedules anytime from transaction details!
- **Seamless 1-Tap Repayment Workflow (Chuẩn hoá Dòng Tiền)**:
  - Execute repayments directly from Planned Expenses: Automatically creates an internal **Transfer** from your Bank Account to the Credit Card wallet.
  - Reduces bank balance, eliminates credit debt, and restores credit limit without double-counting expenses!

### 3. Comprehensive Debt & Loan Tracker
- **Lend / Receivables (Money people owe you)**:
  - Record loans disbursed directly from any selected wallet.
  - Track remaining balances, borrower contact, and due dates with overdue notices.
  - **Partial or Full Debt Collection**: Collect repayments directly into your chosen wallet.
  - Automatically accounted as an **Asset** in Net Worth calculation.
- **Borrow / Payables (Money you owe others)**:
  - Record borrowed amounts and the destination wallet receiving the funds.
  - **Installment or Lump-sum Repayment**: Deduct payments from any wallet.
  - Automatically accounted as **Liabilities**.

### 4. Rapid Transaction Logging with Date & Time Selection
- **Expenses**: Deduct from wallet, assign category (Food & Dining, Coffee, Transport, Shopping, Bills, etc.).
- **Income**: Credit to wallet, assign category (Salary, Bonus, Investment, etc.).
- **Internal Transfers**: Transfer funds between wallets (e.g., Bank to E-Wallet) with instant two-way balance updates without affecting Net Worth.
- **Backdating & Custom Time Selection**:
  - One-tap quick presets: **Today**, **Yesterday**, **2 days ago**.
  - Interactive Neo-Brutalist calendar grid and hour/minute steppers for precise transaction backdating.
- Tactile mobile number keypad with `000` triple-zero button for effortless entry.

### 5. Interactive Neo-Brutalist Home Screen Widget (Android 4x2)
- **Real-Time Financial Overview**: Total assets, monthly income, and monthly expense directly on your Android Home Screen.
- **Interactive Balance Privacy Toggle**: Tap the eye button right on the widget to toggle masking (`••••••`) without needing to launch the app.
- **Tactile 1-Tap Shortcuts**:
  - `[+]` button: Instantly launches the app directly into the quick-expense logger.
  - `[-]` button: Directly logs quick expense.
  - `[Eye]` button: Toggles privacy status immediately.
- **Automatic Instant Sync**: Automatically updates the widget whenever transactions are created, edited, deleted, or wallets are adjusted.

### 6. Smart Multi-Category Habitual Reminders (Nhắc nhở thông minh đa thói quen)
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

### 7. Financial Analytics, Cash Flow & Spending Ratio
- Standard financial formula for **Net Worth**:
  $$\text{Net Worth} = (\text{Total Available Wallet Balances} + \text{Receivables}) - (\text{Credit Card Debt} + \text{Payables})$$
- **Flexible Time Period Filter**: This Week, This Month, Last Month, This Year, All Time.
- Cash flow breakdown: Total Income, Total Expenses, Net Savings, **Savings Rate %**, and **Average Daily Spending**.
- Ratio meter comparing Income vs Expense percentages.
- Category spending distribution with interactive percentage badges and progress tracks.
- Asset allocation breakdown across multiple wallets.
- Privacy eye toggle to mask sensitive figures (`••••••`) in public spaces.

### 8. Custom Category Management
- Manage Expense & Income categories with personalized naming.
- Pick from 24+ curated financial and lifestyle icons.
- Choose from 12+ vibrant Neo-Brutalist color palettes.
- Safely delete categories with automatic transaction unlinking.

### 9. Planned Expenses & Safe-to-Spend (Kế Hoạch Dự Chi & Tiền An Toàn)
- **Schedule Upcoming Future Expenses**:
  - Plan upcoming fixed or variable expenses (house rent, electricity, tuition fees, gifts, etc.).
  - **Target Due Date (Ngày dự chi)** with intelligent relative countdown badges:
    - `Hôm nay đến hạn!` (Urgent warning)
    - `Quá hạn X ngày` (Overdue alert)
    - `Ngày mai` / `Còn X ngày` (Upcoming schedule)
    - `Kỳ sau (MM/YYYY)` (Future cycle indicator)
    - `Đã chi` (Completed)
  - One-tap quick date chips: *Hôm nay, Ngày mai, Sau 3 ngày, 1 tuần tới, Đầu tháng tới*.
- **Accurate Safe-to-Spend Balance (Tiền có thể chi tiêu an toàn)**:
  - Corrected formula avoiding credit debt double-deduction:
    $$\text{Liquid Assets} = \sum \text{Non-Credit Wallets} + \max(0, \text{Credit Overpayment})$$
    $$\text{Upcoming Planned} = \sum_{\text{target\_date} \le \text{EndOfNextMonth}} \text{Pending Planned Expenses}$$
    $$\text{Safe-to-Spend} = \max(0, \text{Liquid Assets} - \text{Upcoming Planned})$$
  - Clearly displayed on both the **Dashboard** and the **Planned Expenses Modal**. Know exactly how much money is safe to spend today without running out of cash for scheduled bills!
- **1-Tap "Đã Chi" / "Thanh Toán" Execution**:
  - Convert any planned expense into an actual expense or credit repayment with 1 tap.
  - Choose the paying wallet, confirm or adjust the actual transacted amount, and add notes.
  - Handled atomically inside an `expo-sqlite` transaction (marks executed, updates balance, creates transaction/transfer).

### 10. Tactile Haptic Feedback (Cảm ứng xúc giác cơ học)
- Powered by `expo-haptics` with fine-tuned vibration pulses.
- Mechanical keypress feedback on the Neo-Brutalist numeric keypad (`0-9`, `000`, `⌫`).
- Distinct haptic feedback patterns for tab switching, saving transactions, and alert warnings.
- User-configurable on/off switch in Settings.

### 11. Biometric (Fingerprint) & Tactile PIN Lock (Bảo mật vân tay & Mã PIN)
- Powered by `expo-local-authentication` and SQLite local encrypted settings.
- **Fingerprint Scanner (Cảm biến vân tay)**: Fast and seamless biometric unlock.
- **Dedicated Neo-Brutalist Numeric Keypad**: 
  - Centered PIN setup modal with an on-screen tactile keypad (no soft keyboard clutter).
  - 2-step setup flow: Step 1 (Create PIN) $\to$ Step 2 (Confirm PIN).
  - Tactile indicator dots (`● ○ ○ ○`) with error shake animation (`Animated.sequence`) on mismatch.
- **Seamless Media Picker Bypass**: Intelligently suppresses redundant fingerprint re-prompts when temporarily backgrounding the app to snap photos with the camera or pick gallery receipts.
- Auto-locks whenever the app is sent to the background or reopened.
- Configurable toggle and PIN change options in Settings.

### 12. AI Receipt, Invoice & Item Scanner (Google Gemini Vision)
- **Universal Multi-Photo Recognition**: Capture receipts, bills, invoices, or everyday physical purchases (e.g. meals, groceries, gadgets) directly from the camera or gallery.
- **Intelligent Financial & Context Extraction**:
  - Automatically identifies whether an image is a formal invoice or physical items (e.g., lunch boxes, drinks) and generates appropriate notes and category mappings.
  - Automatically detects **Payment Method / App / Bank** (e.g., Techcombank, Vietcombank, MoMo, ZaloPay, Cash) from payment screens and receipt stamps.
  - Extracts total payment amount, transaction date & time, itemized breakdown with unit prices, and auto-matches the best expense category.
- **Resilient AI Model Selection & Cascade Fallback**:
  - Customizable preferred model in Settings (`gemini-2.5-flash`, `gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, and `gemini-flash-latest`).
  - Automatic fallback cascade across models when facing rate limits (429), high server load (503), or network issues.
- **Local Receipt Gallery**: Store attachments safely on device, preview full-screen photos in Transaction Details, and manage receipt attachments anytime.

### 13. Comprehensive UI & Layout Robustness (Thiết kế chống tràn giao diện)
- Complete design audit across all screens and modals (`Dashboard`, `Transactions`, `Wallets`, `Debts`, `Analytics`, `Settings`, `PlannedExpensesModal`, `NeoDropdown`, etc.).
- Robust text truncation (`numberOfLines={1}`) and auto font scaling (`adjustsFontSizeToFit`) on large 9-10 digit VND amounts.
- Fluid flex constraints preventing button collisions or screen overflows on small and large mobile displays.

### 14. Receipt Storage Management & Smart Purge (Dọn Dẹp Bộ Nhớ)
- **Storage Analyzer**: Real-time scanner calculating transactions, attached receipt photos, and total disk storage occupied.
- **Customizable Retention Filters**: Scan files older than 30, 60, 90, 180, 365 days or custom day threshold.
- **1-Tap Safe Disk Purge**: Safely delete expired local image files from disk while preserving transaction history and financial balances intact.

### 15. Settings & Complete Data Backup (Import / Export)
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

### 16. Cloudinary Cloud Storage & Offline-First Image Sync (Lưu Trữ Ảnh Đám Mây)
- **High-Security Direct Uploads**: Utilizes **Unsigned Upload Presets** directly via Cloudinary REST API. Zero API Secrets on client devices for airtight security.
- **Hybrid Offline-First Architecture**:
  - Automatically uploads captured receipt photos and wallet QR codes to Cloudinary when enabled.
  - Automatically falls back to local on-device storage (`transaction_receipts/` and `wallet_qrs/`) if offline or unconfigured.
  - Retains existing web URLs seamlessly without redundant re-uploads.
- **Resilient Dual Streaming & Base64 Pipeline**:
  - Attempts native high-speed streaming via `FileSystem.uploadAsync` (multipart).
  - Automatically falls back to Base64 data URIs via standard fetch to ensure 100% compatibility with Expo SDK 57 WinterCG runtime without `FormDataPart` issues.
- **1-Tap Cloud Migration Tool**:
  - Scans all local `file://` receipt and wallet QR images on device.
  - 1-tap batch upload with real-time visual progress bar (`current / total`).
  - Automatically updates SQLite database records to remote HTTPS URLs and purges local files to free up 100% of device storage.
  - Smart sandbox path resolution across development builds and runtime environments.
- **Dedicated Cloudinary Settings Modal**:
  - Elegant Neo-Brutalist card on Settings screen with realtime status badge.
  - Dedicated bottom sheet modal with connection tester, preset configuration, and collapsible setup guide.

### 17. Itemized Bill Splitting & Contact Selector (Chia Đơn Theo Món & Quản Lý Người)
- **Flexible Bill Splitting Modes**:
  - **Equal Split (Chia đều)**: Divide total amount evenly across all participants.
  - **Itemized Split (Chia theo món)**: Assign individual items (food, drinks, items) to specific people with multiple assignees per item.
- **Intelligent Extra Fee & Discount Allocation**:
  - Automatic distribution of shipping fees, service charges, and promo discounts.
  - Choose between **Proportional Distribution (Theo tỷ lệ tiền món)** or **Equal Headcount (Chia đều theo đầu người)**.
- **Quick Contact & Friend Selector (`Chọn người nhanh`)**:
  - Tactile friend selection sheet allowing instant multi-select from recent participants.
  - Seamlessly links with **Debt & Loan Ledger (Ghi sổ nợ)** to track receivables from participants with 1 tap.

### 18. Android System Share Intent Direct Receipt Import (Nhận Ảnh Chia Sẻ Trực Tiếp)
- **Direct System Share Receiver**:
  - Share payment success receipts or transfer confirmations directly from banking apps (Vietcombank, Techcombank, MB Bank, BIDV, etc.) and e-wallets (MoMo, ZaloPay, VNPay).
  - Select **MultiWallet** from the Android system share sheet.
- **Instant Pre-filled Transaction Creator**:
  - Automatically launches the app and opens `QuickAddModal` with the incoming photo pre-attached.
  - Immediately triggers Gemini AI Vision scanner to extract total amount, transfer notes, and auto-match categories without manual typing.
- **Custom Native Config Plugin**: Integrated via `plugins/withShareIntent.js` and Android native intent filters for full EAS Build and local prebuild compatibility.

### 19. Gemini AI Financial Copilot (Trợ lý Tài chính AI đa phương thức & Dual STT)
- **Natural Language Expense & Debt Logging**:
  - Speak or type casually in Vietnamese: *"Trưa nay ăn bún chả 55k ví MoMo"*, *"Đổ xăng 80k tiền mặt"*, *"Cho Tuấn mượn 200k"*.
  - Gemini AI parses amounts (recognizing `k`, `tr`, `triệu`, `nghìn`), transaction types (expense, income, lend, borrow), finds the closest matching wallet & category, and drafts the entry.
- **Dual STT (Speech-to-Text) Architecture**:
  - **In-App Dedicated Mic (`expo-audio`)**: Hold the micro button to record audio in-app $\to$ sends directly to Gemini 2.0 Flash Multimodal Audio API for simultaneous transcription and entity parsing (~1.2s).
  - **Keyboard Native Mic**: Speak directly into the text input using system STT (Gboard / iOS / Laban Key) $\to$ sends raw text to Gemini (~0.3s ultra-fast).
  - **Customizable In-App Mic Switch**: Toggle the dedicated in-app micro button on or off in Settings.
- **6 Rich AI Personalities (Copilot Personas)**:
  - Selectable in Settings via an elegant, space-efficient `NeoDropdown`:
    1. **Vui vẻ, dí dỏm** (`cheerful`): Lạc quan, tràn đầy năng lượng, khen ngợi và trêu đùa vui tươi.
    2. **Khó tính, nghiêm khắc** (`strict`): Viên kiểm toán thép, phê bình chi tiêu bốc đồng, siết chặt kỷ luật.
    3. **Tài phiệt, sang chảnh** (`affluent`): Luôn xưng hô gọi người dùng là Chủ tịch/Sếp, xem tiền bạc là nghệ thuật luân chuyển dòng vốn.
    4. **Bạn thân tâm sự** (`confidant`): Ấm áp, biết lắng nghe, chia sẻ chân thành như tri kỷ.
    5. **Thực tế, tối giản** (`minimalist`): Siêu ngắn gọn, trực diện, chỉ tập trung vào số liệu cốt lõi.
    6. **Gen Z lầy lội** (`genz`): Ngôn ngữ giới trẻ ("ét ô ét", "cháy ví", "10 điểm không có nhưng", "flex").
  - Persistent in SQLite (`app_settings`), dynamically driving both prompt generation and vivid opening greetings.
- **Interactive Financial Q&A with SQLite Context**:
  - Ask natural questions: *"Tháng này uống cafe hết bao nhiêu tiền?"*, *"Ai đang nợ tiền tui?"*, *"Tình hình tài chính tuần này thế nào?"*.
  - AI accesses real-time aggregated SQLite context (wallets, recent spendings, debt ledger) to answer with concrete numbers and insights.
- **Tactile 1-Tap Confirmation Card**:
  - Prevents accidental database writes: displays a Neo-Brutalist interactive preview card (`CopilotTransactionCard`) showing parsed wallet, category, and formatted amount.
  - Simply tap `[✓ Xác nhận ghi sổ]` to write atomically to SQLite and refresh the app state.
- **Polished Neo-Brutalist Layout & Zero Redundancy**:
  - Compact circular FAB (`52x52`, `#38BDF8`, `✨ AI`) pinned at bottom-right with anti-clipping scroll padding.
  - Removed duplicate top input bars from the dashboard, placing Smart Habit Reminders and Net Worth directly at the forefront.

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
├── plugins/
│   └── withShareIntent.js          # Expo Config Plugin injecting Android SEND action for receipts
├── src/
│   ├── components/                 # Reusable Neo-Brutalist UI components
│   │   ├── ai/                     # Gemini AI Financial Copilot components & confirmation cards
│   │   │   ├── CopilotTransactionCard.tsx # 1-tap confirmation card for AI parsed transactions/debts
│   │   │   └── FinancialCopilotModal.tsx  # Natural language Q&A & dual STT voice logger modal
│   │   ├── analytics/              # Modular analytics sub-tabs & burn-down velocity charts
│   │   ├── CategoryManagementModal.tsx # Custom category creation & color/icon picker
│   │   ├── CloudinaryModal.tsx     # Cloudinary cloud sync & local image migration sheet
│   │   ├── DebtModal.tsx           # Loan creation & payment modal
│   │   ├── LockScreenOverlay.tsx   # Biometric & PIN lock overlay
│   │   ├── NeoCard.tsx             # Tactile card component
│   │   ├── NeoDropdown.tsx         # Custom dropdown selector
│   │   ├── PlannedExpensesModal.tsx# Planned expenses & safe-to-spend manager
│   │   ├── QuickAddModal.tsx       # Transaction logger with receipt OCR & date/time picker
│   │   ├── SplitTransactionModal.tsx # Itemized & equal bill splitting with fee allocation
│   │   ├── TransactionDetailModal.tsx # Transaction details with cloud/local receipt viewer
│   │   ├── TransactionItem.tsx     # Individual transaction card
│   │   ├── WalletCard.tsx          # Interactive wallet balance card
│   │   ├── WalletModal.tsx         # Wallet creation & editing modal
│   │   └── WalletQRModal.tsx       # Fullscreen Banking QR code modal & download/share
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
│   │   ├── aiCopilotService.ts     # Gemini Copilot multimodal audio & natural language parser
│   │   ├── cloudinaryService.ts    # Cloudinary REST upload, signed streaming & offline sync
│   │   ├── geminiService.ts        # Gemini Vision API client for receipt OCR & parsing
│   │   ├── googleDriveService.ts   # Google Drive OAuth & file backup API
│   │   ├── habitNotificationService.ts # Habit learning, absence check & local notifications
│   │   ├── predictionService.ts    # Category heuristic prediction
│   │   └── widgetSyncService.ts    # Android Home Widget persistent state sync
│   ├── utils/
│   │   ├── haptics.ts              # Fine-tuned vibration & haptic helpers
│   │   └── imageUtils.ts           # Unified image Base64/URI conversion helper
│   ├── widgets/
│   │   ├── WalletWidget.tsx        # Neo-brutalist Android Home Screen Widget (4x2)
│   │   └── widgetTaskHandler.tsx   # Background click & update task handler
│   └── types/                      # TypeScript data interfaces
├── app.json                        # Expo configuration & plugins
├── eas.json                        # EAS build profiles
└── package.json
```

---

## License

This project is licensed under the MIT License. See [LICENSE](file:///home/thang/coding/multi-wallet-management/LICENSE) for details.
