# MultiWallet (v1.2.7) - Personal Finance & Multi-Source Wallet Management

A modern, high-performance mobile application built with **React Native (Expo SDK 57)**, **TypeScript**, and **Expo SQLite**, crafted with a distinctive, tactile Neo-Brutalist design language. 

Designed for 100% offline-first privacy, MultiWallet gives you total control over all your money sources, loans, expenses, credit cards, BNPL installments, and net worth without relying on any external cloud database.

---

## Key Features

### 1. Multi-Source Wallet & Credit Card Management
- Seamlessly track multiple financial accounts in one place:
  - **Cash**: Daily pockets and cash expenses.
  - **Bank Accounts**: Multiple checking and saving accounts.
  - **E-Wallets**: Digital wallets and fintech services (MoMo, ZaloPay, VNPay, etc.).
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

### 2. Credit Card & Installment Engine
- **Single-Period Deferral**:
  - Record expense on credit card/SPayLater $\rightarrow$ Available credit decreases, cash/bank wallets remain untouched.
  - Automatically schedules linked **Planned Expense** on the expected payment due date.
- **Multi-Period Installments**:
  - Configurable terms (2, 3, 6, 9, 12 periods or custom).
  - **Dual Input Modes**: Enter total principal OR enter amount per term to automatically calculate initial principal.
  - **Support for Pre-existing / Settled Terms**: Seamlessly import historical installments with $k$ terms already settled outside the app. Automatically calculates remaining debt and schedules future payments starting from term $k+1$.
  - Monthly installment fee support (fixed currency fee per period or conversion rate).
  - Interactive **Accordion Preview** avoiding scroll jumps while typing.
  - Flexible **Due Date Adjustment**: Customize due dates with stepper chips (`Card Cycle`, `+15 days`, `+30 days`, `+45 days`) and edit linked installment schedules anytime from transaction details.
- **Seamless 1-Tap Repayment Workflow**:
  - Execute repayments directly from Planned Expenses: Automatically creates an internal **Transfer** from your Bank Account to the Credit Card wallet.
  - Reduces bank balance, eliminates credit debt, and restores credit limit without double-counting expenses.

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

### 6. Smart Multi-Category Habitual Reminders
- **Universal Habit Clustering Engine**: Automatically analyzes your SQLite transaction history to discover recurring behavioral patterns across all categories:
  - **Morning Routine (06:00 - 10:00)**: Morning coffee, breakfast, early-day fuel.
  - **Lunch Routine (11:00 - 14:00)**: Lunch meals, midday drinks.
  - **Afternoon Routine (14:00 - 17:30)**: Afternoon snacks, tea breaks, gym / sports.
  - **Dinner Routine (17:30 - 21:00)**: Dinner, grocery shopping, evening commute.
  - **Monthly Recurring Bills**: Automatically detects recurring utilities (electricity, water, internet, rent) based on monthly spending cycles.
  - **Daily Wrap-up (21:30)**: End-of-day financial reconciliation reminder.
- **100% Offline Local Notifications**: Powered by `expo-notifications`, zero cloud dependencies, complete on-device privacy.
- **Dynamic Smart Absence Check**: If you have already recorded an expense for that specific category in today's window (or paid this month's bill), the app stays completely silent.
- **Individual Habit Toggles in Settings**: View all detected habits with peak time, scheduled time, and toggle each habit on or off individually.
- **1-Tap Quick Add Execution**: Tapping any reminder opens `QuickAddModal` with the corresponding category pre-filled and numeric keypad ready.
- **Playful Friendly Tone (0 Emoji)**: Witty "companion wallet" voice lines, strictly adhering to the project 0-emoji design rule.

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

### 9. Planned Expenses & Safe-to-Spend
- **Schedule Upcoming Future Expenses**:
  - Plan upcoming fixed or variable expenses (house rent, electricity, tuition fees, gifts, etc.).
  - **Target Due Date** with intelligent relative countdown badges:
    - `Due today!` (Urgent warning)
    - `Overdue by X days` (Overdue alert)
    - `Tomorrow` / `X days left` (Upcoming schedule)
    - `Next cycle (MM/YYYY)` (Future cycle indicator)
    - `Paid` (Completed)
  - One-tap quick date chips: *Today, Tomorrow, In 3 days, Next week, Start of next month*.
- **Accurate Safe-to-Spend Balance**:
  - Corrected formula avoiding credit debt double-deduction:
    $$\text{Liquid Assets} = \sum \text{Non-Credit Wallets} + \max(0, \text{Credit Overpayment})$$
    $$\text{Upcoming Planned} = \sum_{\text{target\_date} \le \text{EndOfNextMonth}} \text{Pending Planned Expenses}$$
    $$\text{Safe-to-Spend} = \max(0, \text{Liquid Assets} - \text{Upcoming Planned})$$
  - Clearly displayed on both the **Dashboard** and the **Planned Expenses Modal**. Know exactly how much money is safe to spend today without running out of cash for scheduled bills!
- **1-Tap Repayment Execution**:
  - Convert any planned expense into an actual expense or credit repayment with 1 tap.
  - Choose the paying wallet, confirm or adjust the actual transacted amount, and add notes.
  - Handled atomically inside an `expo-sqlite` transaction (marks executed, updates balance, creates transaction/transfer).

### 10. Tactile Haptic Feedback
- Powered by `expo-haptics` with fine-tuned vibration pulses.
- Mechanical keypress feedback on the Neo-Brutalist numeric keypad (`0-9`, `000`, `⌫`).
- Distinct haptic feedback patterns for tab switching, saving transactions, and alert warnings.
- User-configurable on/off switch in Settings.

### 11. Biometric (Fingerprint) & Tactile PIN Lock
- Powered by `expo-local-authentication` and SQLite local encrypted settings.
- **Fingerprint Scanner**: Fast and seamless biometric unlock.
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
  - **Unit Price Sanitization & Discrepancy Warnings**:
    - Automatically checks and recalculates unit price when `quantity > 1` (e.g. 4 packs of noodles for 26,000₫ $\rightarrow$ corrects unit price to 6,500₫ instead of incorrectly multiplying $4 \times 26,000₫ = 104,000₫$).
    - Cross-references the total sum of items against the actual payment amount, providing friendly discrepancy warnings if discounted by vouchers or subject to tax.
- **Resilient AI Model Selection & Cascade Fallback**:
  - Customizable preferred model in Settings (`gemini-2.5-flash`, `gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, and `gemini-flash-latest`).
  - Automatic fallback cascade across models when facing rate limits (429), high server load (503), or network issues.
- **Local Receipt Gallery**: Store attachments safely on device, preview full-screen photos in Transaction Details, and manage receipt attachments anytime.

### 13. Comprehensive UI & Layout Robustness
- Complete design audit across all screens and modals (`Dashboard`, `Transactions`, `Wallets`, `Debts`, `Analytics`, `Settings`, `PlannedExpensesModal`, `NeoDropdown`, etc.).
- Robust text truncation (`numberOfLines={1}`) and auto font scaling (`adjustsFontSizeToFit`) on large 9-10 digit currency amounts.
- Fluid flex constraints preventing button collisions or screen overflows on small and large mobile displays.

### 14. Receipt Storage Management & Smart Purge
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

### 16. Cloudinary Cloud Storage & Offline-First Image Sync
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

### 17. Itemized Bill Splitting & Contact Selector
- **Flexible Bill Splitting Modes**:
  - **Equal Split**: Divide total amount evenly across all participants.
  - **Itemized Split**: Assign individual items (food, drinks, items) to specific people with multiple assignees per item.
  - **Per-Item Quantity Distribution**: Support assigning specific quantities of an item across participants (e.g. 4 cans of drink $\rightarrow$ 1 for Person A, 3 for Person B) with automated fractional price calculation.
- **Dynamic Item Management & Editable Breakdown**:
  - Add, remove, or modify item names, quantities, and prices directly in the bill creation modal with real-time balance reconciliation.
- **Intelligent Extra Fee & Discount Allocation**:
  - Automatic distribution of shipping fees, service charges, and promo discounts.
  - Choose between **Proportional Distribution (by item price ratio)** or **Equal Headcount (split equally per person)**.
- **Quick Contact & Friend Selector**:
  - Tactile friend selection sheet allowing instant multi-select from recent participants.
  - Seamlessly links with **Debt & Loan Ledger** to track receivables from participants with 1 tap.

### 18. Android System Share Intent Direct Receipt Import
- **Direct System Share Receiver**:
  - Share payment success receipts or transfer confirmations directly from banking apps and e-wallets.
  - Select **MultiWallet** from the Android system share sheet.
- **Instant Pre-filled Transaction Creator**:
  - Automatically launches the app and opens `QuickAddModal` with the incoming photo pre-attached.
  - Immediately triggers Gemini AI Vision scanner to extract total amount, transfer notes, and auto-match categories without manual typing.
- **Custom Native Config Plugin**: Integrated via `plugins/withShareIntent.js` and Android native intent filters for full EAS Build and local prebuild compatibility.

### 19. Gemini AI Financial Copilot
- **Multi-Turn Memory & Co-reference Resolution**:
  - Automatically chains items from previous photo uploads when the user sends a follow-up message with payment amount or wallet (e.g., photo of energy drink $\rightarrow$ message "20k cash" $\rightarrow$ creates 20,000₫ transaction for "Red Bull Energy Drink").
  - Seamlessly resolves demonstrative pronouns ("that money", "the recent top-up", "that wallet") by querying recent conversational context.
- **Multimodal Item Breakdown & 0đ Guard**:
  - Automatically extracts itemized details (name, quantity, unit price) into the `items` field when scanning receipts, meal plates, or grocery baskets.
  - Strictly prevents 0đ transactions when amounts cannot be inferred: switches to a friendly `query` intent to ask for amount and wallet naturally.
- **Debounce & Double-Tap Prevention**:
  - Synchronous lock (`useRef`) and loading spinners across all confirmation buttons (`QuickAddModal`, `CopilotTransactionCard`, `FinancialCopilotModal`), preventing duplicate transaction creation during cloud image uploads.
- **Instant Balance Adjustment (`adjust_balance`)**:
  - Understands natural commands: *"My physical cash wallet currently has 200k, please adjust it"*, *"Vietcombank balance is now 8 million"*.
  - Compares current balance from SQLite, calculates the difference (`diff`), and displays an old $\rightarrow$ new comparison card with a 1-tap confirmation button.
- **Update & Delete Transactions via Dialogue (`update_transaction` & `delete_transaction`)**:
  - **Flexible Void / Delete**: Recognizes natural phrasing: *"Cancel that one"*, *"Delete the recent coffee expense"*, *"Void the fuel expense from this afternoon"*. Locates the target transaction ID and presents a confirmation card with automatic balance reversal warnings.
  - **Update Recent Transactions**: Handles modifications: *"Change the last transaction to 35k"*, *"Switch noodle soup to MoMo wallet"*, *"Update note to Salt Coffee"*. Automatically rolls back balance diffs from old wallets and atomically applies new amounts.
- **Batch Multi-Transaction Parsing**:
  - Simultaneously extracts multiple income or expense entries from a single spoken or typed sentence (e.g., *"Breakfast pho 45k, coffee 25k, motorcycle fuel 50k cash"*).
  - Automatically assigns appropriate categories and wallets to each individual item.
  - Presents an intuitive Neo-Brutalist confirmation card with total amount, item count, and a 1-tap `[✓ Save N Transactions]` button.
- **Full Action Tools Suite**:
  - **Inter-wallet Transfer (`transfer_money`)**: Interprets *"Transfer 500k from VCB to MoMo"* $\rightarrow$ generates an instant source-to-destination transfer card.
  - **Smart Debt Settlement (`settle_debt`)**: Interprets *"Tuan just repaid 200k into MoMo"* or *"Pay back Nam 500k in cash"* $\rightarrow$ cross-references SQLite debts to match borrower/creditor and generates repayment cards.
  - **Planned Expense Creation (`create_planned`)**: Interprets *"Schedule rent payment of 3 million on the 15th"* $\rightarrow$ schedules a Planned Expense on the exact target date.
  - **New Debt Logging (`create_debt`)**: Recognizes lending or borrowing requests with flexible due dates.
- **Natural Text-to-Speech (TTS Voice Responses)**:
  - Smooth Vietnamese voice synthesis (`expo-speech`), dynamically modulating pitch and rate according to the selected Copilot personality.
  - Smart currency and Markdown sanitizer (`50k` $\rightarrow$ `50 nghìn`, `100.000₫` $\rightarrow$ `100 nghìn đồng`) ensuring clean speech delivery.
  - Instant speech cut-off when touching/holding the microphone or typing to prevent overlapping audio.
  - Quick Voice Toggle (`volume-high` / `volume-mute`) directly in the modal header and Settings screen.
- **In-Chat Multi-Image Receipt Scanning & Persistence**:
  - Integrated Camera and Multi-Photo Gallery pickers directly adjacent to the chat input bar.
  - Horizontal thumbnail preview strip with 1-tap removal and clear-all controls.
  - Submits multimodal Base64 image arrays to Gemini 2.0 Flash to parse multi-page or multi-receipt batches simultaneously.
  - Upon confirmation, receipt images are persistently saved to local storage or Cloudinary and attached to SQLite transaction records.
- **Dual STT (Speech-to-Text) Architecture**:
  - **In-App Dedicated Mic (`expo-audio`)**: Press and hold the mic button in-app $\rightarrow$ streams audio directly to Gemini 2.0 Flash Multimodal API (~1.2s).
  - **Keyboard Native Mic**: Dictate directly via system keyboard (Gboard / iOS / Laban Key) $\rightarrow$ ultra-fast text processing (~0.3s).
  - **Configurable Mic Toggle**: Customize in-app mic visibility in Settings.
- **6 Rich AI Personalities (Copilot Personas)**:
  - Selectable in Settings via an elegant, space-efficient `NeoDropdown`:
    1. **Cheerful & Witty** (`cheerful`): Optimistic, energetic, encouraging, and playful.
    2. **Strict & Disciplined** (`strict`): Iron auditor, critiques impulsive spending, enforces budgeting discipline.
    3. **Affluent Executive** (`affluent`): Addresses user as CEO/Boss, treats personal finance as strategic capital allocation.
    4. **Caring Confidant** (`confidant`): Warm, attentive listener, empathetic like a close companion.
    5. **Pragmatic Minimalist** (`minimalist`): Ultra-concise, direct, laser-focused on core numbers.
    6. **Youthful Gen Z** (`genz`): Vibrant, trendy slang, humorous pop-culture references.
  - Persisted in SQLite (`app_settings`), dynamically driving both prompt generation and vivid opening greetings.
- **Interactive Financial Q&A with SQLite Context**:
  - Ask natural questions: *"How much did I spend on coffee this month?"*, *"Who owes me money?"*, *"How is my financial standing this week?"*.
  - AI queries aggregate SQLite data (wallets, recent spending, debts) to deliver precise numbers and actionable insights.

### 20. Smart Payee & Transfer Receipt Mapping
- **Intelligent Payee Learning Engine (`payee_mappings`)**:
  - Automatically detects recipient name and account number from bank transfer screenshots or receipts (Vietcombank, MB, Techcombank, MoMo, ZaloPay, etc.).
  - Normalizes payee names (accent-insensitive, strips bank prefixes like "Chuyển khoản đến", "Người nhận:").
  - Seamlessly learns custom mappings when the user customizes Note or Category (e.g. transferring to "Nguyễn Văn A" $\rightarrow$ renamed to "Red Bull", category "Coffee & Beverages").
- **Automatic Auto-Fill on Subsequent Scans**:
  - Automatically pre-fills Note = "Red Bull" and Category = "Coffee & Beverages" when subsequent transfers to the same recipient are scanned.
  - Displays a distinctive visual badge: `💡 Auto-filled based on past transfers to [Name]`.
  - Provides 1-tap chips to switch between alternative notes previously used for that payee.
- **Deep Copilot & OCR Integration**:
  - Injects learned payee habits directly into Gemini Financial Copilot context, accurately resolving notes and categories across both image uploads and natural language commands.
- **Full Settings Control (On/Off Toggle & Management)**:
  - Toggle switch under **Gemini AI** settings to turn the feature on or off at will.
  - Live count badge showing number of memorized payees.
  - Dedicated **Manage Payee Habits** modal to review payee details, usage frequencies, and delete individual mappings with 1 tap.

### 21. In-App System Log Viewer & Logger Service
- **Rotating File Logger (`loggerService.ts`)**:
  - Automatically captures structured logs across key app subsystems: SQLite database queries, Google Drive OAuth/backup sync, Gemini AI Copilot calls, Cloudinary media transfers, and system runtime errors.
  - Keeps up to 500 in-memory events and writes rotating local `.log` files in cache directory.
- **Dedicated Log Viewer Modal (`LogViewerModal.tsx`)**:
  - Accessible directly from Settings $\rightarrow$ System & Options $\rightarrow$ System Activity Logs.
  - Multi-level filtering: **All**, **INFO**, **WARN**, **ERROR**.
  - Real-time keyword search across log messages and tags.
  - 1-tap **Copy Entire Log** or individual **[📋 Copy]** per log line with animated checkmark and haptic feedback.
  - Share or export the full raw `.log` file to external apps (Telegram, Zalo, Gmail, Drive).

### 22. Advanced Planned Expenses & Batch Actions
- **Custom Date Range Filter**:
  - Filter upcoming planned expenses by **All**, **Next 7 Days**, **Next 30 Days**, **This Month**, or **Custom** (custom start & end dates).
- **Dynamic Summary Card**:
  - Displays filtered expense count and aggregate payable amount in real-time.
- **Multi-Select & Bulk Deletion via Long Press**:
  - Long press any planned expense item to enter selection mode with checkable boxes.
  - Floating action bar shows selected count with 1-tap batch deletion with safety confirmation modal.

### 23. Neo-Brutalist Accordion Settings & Google Drive Cloud Sync
- **Collapsible Settings Architecture**:
  - 11 major settings sections organized into clean, independent accordion cards.
  - Each item features a distinctive pastel pop color, prominent icon, descriptive subtitle, and live status badge.
  - Smooth animation powered by React Native `LayoutAnimation` with zero New Architecture / Fabric warning noise.
- **Google Drive OAuth & Automated Backup**:
  - Seamless backup to Google Drive AppData folder.
  - Integrated OAuth Client ID configuration with 1-tap paste and save.
  - Quick-copy redirect URIs for both Expo Go development and standalone APK builds.
  - CI/CD workflow automatically extracts and prints keystore SHA-1 fingerprint for Google Cloud Console setup.

---

## Technology Stack

- **Framework**: React Native 0.86 + Expo SDK 57 (New Architecture enabled)
- **Language**: TypeScript 6.0
- **Database**: `expo-sqlite` (WAL mode enabled, foreign keys enforced)
- **Home Widget**: `react-native-android-widget` (Neo-brutalist interactive widget)
- **Local Notifications**: `expo-notifications` (Offline habit reminders & absence check)
- **Voice & Speech**: `expo-audio` (Microphone input) & `expo-speech` (Text-to-Speech)
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
   git push -u origin main
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
│   │   ├── LogViewerModal.tsx      # System activity logs, filtering & export modal
│   │   ├── NeoCard.tsx             # Tactile card component
│   │   ├── NeoDropdown.tsx         # Custom dropdown selector
│   │   ├── PlannedExpensesModal.tsx# Planned expenses, date filters & batch delete
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
│   │   ├── loggerService.ts        # System runtime logging, rotation & log exporting
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
