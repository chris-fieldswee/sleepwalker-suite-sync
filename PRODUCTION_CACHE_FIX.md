# Production Cache Fix Instructions

## Issue
The fixes work locally but not in production due to cached JavaScript bundles and service worker cache.

## Solution Steps

### 1. Rebuild and Redeploy
After pushing the latest changes, ensure a fresh build is deployed:

```bash
# Commit and push your changes
git add .
git commit -m "Fix OTHER room validation and time limit calculation"
git push

# If using Vercel, it will auto-deploy
# If using other platforms, trigger a new build
```

### 2. Clear Service Worker Cache (For Users)
Users need to clear the service worker cache. Provide these instructions:

**Option A: Clear via Browser DevTools (Recommended)**
1. Open the production site
2. Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows) to open DevTools
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Click **Service Workers** in the left sidebar
5. Click **Unregister** next to the service worker
6. Go to **Cache Storage** in the left sidebar
7. Right-click and select **Delete** for each cache entry
8. Go to **Clear storage** in the left sidebar
9. Click **Clear site data**
10. Hard refresh the page: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)

**Option B: Clear via Browser Settings**
1. Open browser settings
2. Go to Privacy/Security settings
3. Find "Clear browsing data" or "Site data"
4. Select "Cached images and files" and "Cookies and site data"
5. Clear data for the production domain
6. Hard refresh the page

### 3. Force Service Worker Update (Automatic)
The updated code now includes automatic service worker update checking. When a new version is detected, users will be prompted to reload.

### 4. Verify the Fix
After clearing cache:
1. Navigate to an OTHER location task
2. Try to edit and save the task
3. Verify no validation errors occur
4. Verify time limit is visible

## Technical Changes Made

1. **Updated validation schema** (`src/lib/validation.ts`):
   - Now accepts numeric strings (1, 2, 3, etc.) for OTHER rooms
   - Accepts letter identifiers (a-h) for regular rooms
   - Accepts legacy 'other' value

2. **Updated PWA configuration** (`vite.config.ts`):
   - Changed `registerType` to `'prompt'` to force update checks
   - Added `skipWaiting: true` and `clientsClaim: true` to force immediate updates
   - Added version query param to `start_url`

3. **Added service worker update handling** (`src/main.tsx`):
   - Automatically checks for service worker updates on page load
   - Prompts users to reload when updates are available

## Prevention
To prevent this issue in the future:
- Always test in production after deployment
- Consider adding a version number to the app that users can see
- Use `registerType: 'prompt'` for PWA to ensure users get updates
- Clear service worker cache during testing

