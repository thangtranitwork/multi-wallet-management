# MultiWallet (v1.2.6) - Personal Finance & Multi-Source Wallet Management

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

### 19. Gemini AI Financial Copilot
- **Multi-Turn Memory & Co-reference Resolution (Quy chiếu đại từ & Kế thừa ngữ cảnh)**:
  - Tự động xâu chuỗi món đồ ở lượt gửi ảnh trước khi người dùng gửi thêm tin nhắn bổ sung tiền/ví (ví dụ: chụp ảnh bò cụng $\rightarrow$ nói "20k tiền mặt" $\rightarrow$ tự động tạo giao dịch 20.000đ cho "Lon bò cụng (Red Bull)").
  - Xử lý mượt mà các đại từ chỉ định ("tiền đó", "khoản vừa nạp", "ví đó") bằng cách tra cứu lịch sử hội thoại gần nhất.
- **Multimodal Item Breakdown & 0đ Guard**:
  - Tự động bóc tách chi tiết từng món hàng (tên, số lượng, đơn giá) vào trường `items` khi chụp hóa đơn hoặc mâm cơm/giỏ hàng nhiều món.
  - Chặn triệt để việc tạo giao dịch 0đ khi ảnh chưa rõ giá tiền: tự động chuyển sang intent `query` để hỏi tiền và ví tự nhiên.
- **Debounce & Double-Tap Prevention (Chống bấm nhanh tạo trùng giao dịch khi upload Cloudinary)**:
  - Khóa đồng bộ (`useRef` lock) và hiển thị loading spinner trên tất cả các nút xác nhận giao dịch (`QuickAddModal`, `CopilotTransactionCard`, `FinancialCopilotModal`), ngăn chặn việc tạo trùng lặp giao dịch trong lúc tải ảnh lên đám mây. (Trợ lý Tài chính AI Đa Năng, Voice TTS, Action Tools & Quản lý Hội thoại)
- **Cân đối / Điều chỉnh số dư ví tức thì (`adjust_balance`)**:
  - Tự động hiểu câu lệnh cân bằng số dư: *"Ví tiền mặt thực tế đang còn 200k, cân chỉnh lại giúp tui"*, *"Số dư Vietcombank giờ là 8tr"*.
  - AI tự đối chiếu số dư hiện tại từ SQLite, tính toán chênh lệch (`diff`) tăng/giảm và hiển thị thẻ so sánh số dư cũ $\rightarrow$ số dư mới với nút xác nhận cập nhật chỉ với 1 chạm.
- **Sửa & Xóa giao dịch qua hội thoại (`update_transaction` & `delete_transaction`)**:
  - **Hủy / Xóa giao dịch linh hoạt**: Nhận diện câu nói tự nhiên: *"Ê nhầm rồi, hủy cái đó đi"*, *"Xóa giao dịch cafe vừa tạo"*, *"Hủy giao dịch đổ xăng trưa nay"*. AI tự tra cứu ID giao dịch gần nhất, hiển thị thẻ xác nhận xóa kèm cảnh báo hoàn trả tiền vào số dư ví tự động.
  - **Cập nhật giao dịch gần đây**: Nhận diện các lệnh sửa đổi: *"Sửa giao dịch vừa rồi thành 35k"*, *"Đổi ví bún bò sang ví MoMo"*, *"Sửa ghi chú thành Cà phê muối"*. Hệ thống tự động rollback chênh lệch số dư ở ví cũ và áp dụng số dư mới vào ví đích một cách nguyên tử (atomic transaction).
- **Multimodal Object Recognition & Item Breakdown (Nhận diện Đồ vật & Bóc tách Từng món)**:
  - Chụp ảnh đồ ăn, thức uống (tô phở, lon nước ngọt, mâm cơm, giỏ hàng siêu thị): AI nhận diện chính xác danh sách từng món đồ kèm số lượng, tự phân bổ đơn giá và lưu danh sách chi tiết vào trường `items` của bảng `transactions` trong SQLite.
  - **Multi-turn Memory (Ghi nhớ ngữ cảnh đa lượt)**: Gửi ảnh đồ vật ở lượt 1, sau đó ở lượt 2 chỉ cần nhắn hoặc nói *"20k tiền mặt"* $\rightarrow$ AI tự động xâu chuỗi thông tin món đồ từ ảnh lượt trước để tạo ngay giao dịch hoàn chỉnh, không bao giờ bị quên ngữ cảnh.
- **Batch Multi-Transaction Parsing (Bóc tách chuỗi giao dịch & Hóa đơn nhiều món)**:
  - Tự động nhận diện nhiều khoản chi tiêu / thu nhập cùng lúc trong một câu nói hoặc văn bản (ví dụ: *"Sáng ăn phở 45k, cafe 25k, đổ xăng 50k ví Tiền mặt"*).
  - Tự động gán danh mục và ví tiền phù hợp cho từng món riêng lẻ.
  - Hiển thị thẻ xác nhận Neo-Brutalist trực quan với tổng số tiền, số lượng giao dịch, danh sách chi tiết và nút `[✓ Lưu N giao dịch • Số tiền]` ghi đồng thời vào SQLite chỉ với 1 chạm.
- **Full Action Tools Suite (Bộ công cụ hành động mở rộng)**:
  - **Chuyển tiền giữa các ví (`transfer_money`)**: Hiểu câu lệnh *"Chuyển 500k từ VCB sang MoMo"* $\rightarrow$ sinh thẻ xác nhận chuyển ví nguồn - ví đích tức thì.
  - **Tất toán nợ thông minh (`settle_debt`)**: Hiểu câu lệnh *"Tuấn vừa trả 200k vào MoMo"* hoặc *"Trả nợ anh Nam 500k tiền mặt"* $\rightarrow$ tự động tra cứu danh sách nợ trong SQLite để khớp người vay/chủ nợ và sinh thẻ thu/trả nợ.
  - **Lên kế hoạch chi tiêu (`create_planned`)**: Hiểu câu lệnh *"Lên lịch ngày 15 đóng tiền nhà 3 triệu"* $\rightarrow$ sinh thẻ tạo Planned Expense vào đúng ngày hẹn.
  - **Ghi nhận nợ mới (`create_debt`)**: Nhận diện khoản cho vay hoặc đi vay với ngày hẹn trả linh hoạt.
- **Responsive Layout Co-adaptation & Safe Date Parsing (Chống vỡ layout & Lỗi ngày tháng)**:
  - Thẻ xác nhận và nút bấm co giãn thông minh: nhãn nút tự động xuống dòng 2 tầng căn giữa cân đối, cỡ chữ tự co (`adjustsFontSizeToFit`) khi số tiền lên đến hàng trăm tỷ VND.
  - Bộ định dạng thời gian `formatCopilotDate` xử lý linh hoạt mọi chuẩn thời gian (ISO, tiếng Việt `HH:mm DD/MM/YYYY`), triệt tiêu hoàn toàn lỗi `Invalid Date`.
  - Mở rộng toàn bộ chiều rộng (`flex: 1`) cho bong bóng phản hồi chứa thẻ hành động.
- **Natural Vietnamese Text-to-Speech (TTS Voice Phản Hồi Giọng Nói)**:
  - Giọng đọc tiếng Việt mượt mà (`expo-speech`), tự động điều chỉnh cao độ (pitch) và tốc độ (rate) theo đúng 6 tính cách Copilot (Kỷ luật nghiêm khắc đọc dứt khoát, Vui vẻ đọc nhanh hào hứng, v.v.).
  - Bộ làm sạch Markdown & đơn vị tiền tệ thông minh (`50k` $\rightarrow$ `50 nghìn`, `100.000₫` $\rightarrow$ `100 nghìn đồng`), loại bỏ ký tự lạ giúp giọng đọc trôi chảy.
  - Tự động ngắt phát âm tức thì khi chạm/giữ micro hoặc gõ phím để tránh dính âm thanh.
  - Nút chuyển đổi nhanh Giọng đọc (`volume-high` / `volume-mute`) ngay trên thanh tiêu đề và toggle bật/tắt trong màn hình Cài đặt.
- **In-Chat Multi-Image Receipt Scanning & Persistence (Quét Nhiều Hóa Đơn & Lưu Ảnh Vào Giao Dịch)**:
  - Tích hợp nút Chụp ảnh (Camera) và Chọn nhiều ảnh thư viện (Gallery) trực tiếp ngay cạnh thanh soạn thảo chat.
  - Thanh xem trước ảnh ngang trực quan với nút gỡ nhanh từng ảnh và xóa tất cả.
  - Gửi đồng thời mảng ảnh Multimodal Base64 đến Gemini 2.0 Flash để bóc tách hóa đơn nhiều trang/nhiều biên lai cùng lúc.
  - Khi xác nhận (`Lưu tất cả` / `Xác nhận ghi sổ`), ảnh hóa đơn được tự động lưu vĩnh viễn (hoặc đồng bộ Cloudinary) và gắn trực tiếp vào giao dịch.
- **Dual STT (Speech-to-Text) Architecture**:
  - **In-App Dedicated Mic (`expo-audio`)**: Giữ nút micro trong app $\rightarrow$ gửi thẳng audio stream đến Gemini 2.0 Flash Multimodal API (~1.2s).
  - **Keyboard Native Mic**: Đọc trực tiếp qua bàn phím hệ thống (Gboard / iOS / Laban Key) $\rightarrow$ gửi text tới Gemini (~0.3s ultra-fast).
  - **Tùy biến Mic trong Cài đặt**: Bật/tắt nút ghi âm trong app tùy nhu cầu.
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
  - Hỏi đáp tự nhiên: *"Tháng này uống cafe hết bao nhiêu tiền?"*, *"Ai đang nợ tiền tui?"*, *"Tình hình tài chính tuần này thế nào?"*.
  - AI truy xuất dữ liệu SQLite tổng hợp (ví, chi tiêu gần đây, sổ nợ) để đưa ra con số chính xác và lời khuyên hữu ích.
- **Tactile Neo-Brutalist Layout & Streamlined UI**:
  - Header thanh thoát với chấm trạng thái tính cách thời gian thực (`● Kỷ luật thép • Gemini Flash`).
  - Nút bấm nổi (FAB) nhỏ gọn (`52x52`, `#38BDF8`, `✨ AI`) góc dưới phải màn hình với chống che khuất.

### 11. In-App System Log Viewer & Logger Service
- **Rotating File Logger (`loggerService.ts`)**:
  - Automatically captures structured logs across key app subsystems: SQLite database queries, Google Drive OAuth/backup sync, Gemini AI Copilot calls, Cloudinary media transfers, and system runtime errors.
  - Keeps up to 500 in-memory events and writes rotating local `.log` files in cache directory.
- **Dedicated Log Viewer Modal (`LogViewerModal.tsx`)**:
  - Accessible directly from Settings $\rightarrow$ Tùy chọn & Hệ thống $\rightarrow$ Nhật ký hoạt động.
  - Multi-level filtering: **Tất cả**, **INFO**, **WARN**, **ERROR**.
  - Real-time keyword search across log messages and tags.
  - 1-tap **Copy Entire Log** or individual **[📋 Chép]** per log line with animated checkmark and haptic feedback.
  - Share or export the full raw `.log` file to external apps (Telegram, Zalo, Gmail, Drive).

### 12. Advanced Planned Expenses (Dự Chi) & Batch Actions
- **Custom Date Range Filter**:
  - Filter upcoming planned expenses by **Tất cả**, **7 ngày tới**, **30 ngày tới**, **Tháng này**, or **Tùy chọn** (custom start & end dates).
- **Dynamic Summary Card**:
  - Displays filtered expense count and aggregate payable amount in real-time.
- **Multi-Select & Bulk Deletion via Long Press**:
  - Long press any planned expense item to enter selection mode with checkable boxes.
  - Floating action bar shows selected count with 1-tap batch deletion with safety confirmation modal.

### 13. Neo-Brutalist Accordion Settings & Google Drive Cloud Sync
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
- **Voice & Speech**: `expo-audio` (Microphone input) & `expo-speech` (Vietnamese Text-to-Speech)
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
