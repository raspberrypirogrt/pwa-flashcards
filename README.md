<div align="center">
  <img src="public/pwa-192x192.png" alt="App Icon" width="120" />
  <h1>記憶卡片 (PWA Flashcards)</h1>
  <p>專為深度記憶設計的極簡、離線、免安裝單字卡 APP</p>
</div>

---

## 🌟 給使用者的快速指南 (For Users)

### 什麼是「記憶卡片」？
「記憶卡片」是一個基於 **間隔重複系統 (Spaced Repetition System)** 的學習輔助工具。無論你是想要背誦多益單字、準備轉學考、或是記憶專業名詞，系統都會自動幫你安排複習時間。越不熟的單字出現越頻繁，越熟的單字則拉長複習間隔，讓你用最少的時間記住最多的東西。

最棒的是：**這是一個 PWA（漸進式網頁應用程式）**。
你不需要去 App Store 下載，也不需要註冊帳號。所有的單字與學習進度都安全地保存在你自己的手機中，完全無廣告、不收費，且在**沒有網路**的情況下也能順暢使用！

### 🚀 核心功能介紹
- 🧠 **科學化間隔重複**：內建 9 個學習等級（從「倉庫預備」到「完全畢業」），每次複習只要點「會」或「不會」，系統自動計算下次複習日期。
- 📱 **流暢的滑動設計**：支援手機上的 Tinder-style 左右滑動操作，右滑記住了、左滑忘記了，單手就能輕鬆複習。
- 📦 **強大批量匯入**：支援一鍵匯入 CSV/JSON，可直接用 Excel 編輯完幾百個單字後一次匯入。
- 🧮 **完美支援數學與圖片**：完美支援 LaTeX 數學公式（免打 `$` 符號），並且可以直接從相簿上傳圖片到正背面。
- 📴 **100% 離線與備份**：無須連網即可學習。可一鍵匯出 JSON 備份檔，隨時將進度轉移到其他設備。

### 📱 如何安裝到手機桌面上？
這是一個可以直接「安裝」在手機桌面上使用的 APP：
- **🍎 iOS (iPhone / iPad)**：打開 **Safari** 進入網址 $\rightarrow$ 點擊底部的 **「分享」** 按鈕 $\rightarrow$ 選擇 **「加入主畫面」** $\rightarrow$ 點擊右上角新增。
- **🤖 Android**：打開 **Chrome** 進入網址 $\rightarrow$ 點擊畫面的 **「加到主畫面」** 提示（或瀏覽器右上角選單）。從桌面打開即可享有全螢幕無邊框的沉浸體驗。

### 💡 最佳使用建議
1. **循序漸進**：每天只從「倉庫」抽出 10~20 張新卡片開始學習，不要一次抽太多以免複習量爆炸。
2. **保持紀律**：首頁的「今日任務」會顯示今天到期的卡片，每天花 5 分鐘把它清空，你的「已學習 X 天」進度就會不斷推進！

---

## 🛠 給開發者的架構導覽 (For Developers)

Welcome to the `pwa-flashcards` repository! This is a modern, offline-first Progressive Web Application built for spaced-repetition learning.

### 💻 Technology Stack
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Vanilla CSS (CSS Variables for theming, Glassmorphism aesthetics)
- **Database**: LocalForage (IndexedDB abstraction for robust offline storage)
- **Icons**: Lucide React
- **Math Rendering**: KaTeX (`react-latex-next`)
- **PWA Capabilities**: `vite-plugin-pwa` (Service workers, manifest, offline caching)
- **Deployment**: GitHub Pages (`gh-pages`)

### 📁 Project Structure
```text
src/
├── components/          # Reusable UI components
│   ├── BatchImportModal.tsx    # CSV/JSON parsing and import preview
│   ├── ConfirmDialog.tsx       # iOS PWA-safe confirmation dialog
│   └── FlashcardReview.tsx     # The core swipeable review logic 
├── db/                  # Database and Schema layer
│   ├── schema.ts               # TypeScript interfaces (Tag, Card, UserStats)
│   └── store.ts                # IndexedDB CRUD operations using LocalForage
├── pages/               # Main application routes
│   ├── HomePage.tsx            # Dashboard, Stats, and Tags overview
│   ├── TaskPage.tsx            # Daily review queue and drawing new cards
│   ├── AddCardPage.tsx         # Manual card creation and batch import entry
│   └── DeckPage.tsx            # Card repository, search, edit, and level filtering
├── utils/               # Helpers
│   └── math.ts                 # LaTeX wrapper utilities
├── App.tsx              # React Router setup, Bottom Navigation, and iOS PWA fixes
└── index.css            # Global styles, variables, and glassmorphism UI
```

### 🧠 Core Mechanics (Spaced Repetition Engine)
The SRS logic assumes 9 fixed levels defined in `schema.ts`:
- `Level 0`: **Warehouse** (Inactive/Stored cards)
- `Level 1`: **Today** (0 days interval)
- `Level 2-7`: **Active Memory** (1, 3, 7, 15, 31, 63 days intervals)
- `Level 8`: **Graduated** (Mastered, no longer reviewed)

*Algorithm*: When a user reviews a card and selects "Know" (會), the card increments to the next level ($\text{NextReviewDate} = \text{Date.now()} + \text{Interval}$). If they select "Forgot" (不會), the card drops immediately back to `Level 1` to be reviewed again today.

### 🚀 Getting Started Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```

**Generate PWA Icons:**
If you want to swap the app icon, replace the source image and run:
```bash
npx esno scripts/generate-icons.js "path/to/your/square-image.png"
```
This uses `sharp` to automatically generate `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, and `favicon.ico` directly into the `/public` folder.

### 🚀 Deployment
This project is configured perfectly for GitHub pages.
```bash
# Verify your vite.config.ts has the correct `base` path
npm run build
git add . && git commit -m "deploy" && git push
npx gh-pages -d dist
```
