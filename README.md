# 記憶卡片 (PWA Flashcards)

這是一個以 Vite + React + TypeScript 打造的現代化記憶卡片漸進式網路應用程式 (PWA)。它旨在提供一個簡潔、直觀且可以在離線狀態下使用的互動學習工具。

## 功能特色
- 📝 **自訂牌組與卡片**：隨時新增、編輯和管理您的學習內容
- 🔄 **互動式複習**：直覺的滑動卡片切換設計 (支援動畫效果)
- 📴 **離線使用 (PWA)**：支援安裝到手機或電腦桌面，無網路也能複習
- 🎨 **現代化設計**：乾淨明亮的 UI 介面
- ⚡ **極速體驗**：基於 Vite 的極速開發與建置

## 本地開發

### 安裝依賴
```bash
npm install
```

### 啟動開發伺服器
```bash
npm run dev
```

### 生產環境建置
```bash
npm run build
```

## 部署到 GitHub Pages 🚀

這個專案已經設定好 GitHub Actions (`.github/workflows/deploy.yml`)，這意味著您只要將程式碼推送到 GitHub，它就會自動幫您打包並部署到 GitHub Pages。

### 部署教學 (請依照以下步驟)

1. **修改 Vite Base 路徑**
   請打開 `vite.config.ts` 檔案，在 `defineConfig` 中新增 `base` 屬性：
   ```typescript
   export default defineConfig({
     base: '/您的倉庫名稱/', // <--- 例如：如果您建立的倉庫叫 pwa-flashcards，這裡就填 '/pwa-flashcards/'
     plugins: [
       // ...
     ]
   });
   ```

2. **在 GitHub 上建立一個新的倉庫 (Repository)**
   - 前往 [GitHub - Create a new repository](https://github.com/new)
   - 在 **Repository name** 填寫您的專案名稱 (例如：`pwa-flashcards`)
   - 確保選擇 **Public** (如果是 Private 倉庫，GitHub Pages 可能需要付費版才能使用)
   - **不要** 勾選 "Add a README file" 或 "Add .gitignore" (保持倉庫全空)
   - 點擊綠色的 **Create repository** 按鈕

3. **將本地程式碼推送到 GitHub**
   打開終端機 (Terminal)，確認您在專案目錄下，依序執行以下指令：
   ```bash
   # 1. 確保 git 已初始化
   git init
   
   # 2. 加入所有檔案
   git add .
   
   # 3. 提交變更
   git commit -m "Init project and setup GH Pages deployment"
   
   # 4. 將預設分支重新命名為 main
   git branch -M main
   
   # 5. 這裡換成您剛剛建立的倉庫網址！(請看 GitHub 頁面上的提示)
   git remote add origin https://github.com/您的帳號/您的倉庫名稱.git
   
   # 6. 推送程式碼！
   git push -u origin main
   ```

4. **開啟 GitHub Pages 與 GitHub Actions 設定**
   - 進入您剛剛創建好的 GitHub 倉庫頁面。
   - 點擊上方的 **Settings** 標籤。
   - 點擊左邊選單的 **Pages**。
   - 在 **Build and deployment** 區域的 **Source** 下拉選單中，選擇 **GitHub Actions**。
   - (建議檢查) 點擊左邊選單 **Actions** -> **General**，滑到最下方的 **Workflow permissions**，確保是勾選 **Read and write permissions**，然後按 Save。

完成以上所有步驟後，只要您點擊上方的 **Actions** 標籤，就會看到 GitHub 正在幫您打包部署（這大概需要 1~2 分鐘）。當它顯示綠色打勾時，您的網頁就正式上線了！
