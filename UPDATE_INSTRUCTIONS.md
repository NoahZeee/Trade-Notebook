# Trade Notebook — Update Instructions

This guide walks you through updating Trade Notebook from source code to a fresh Windows installer while preserving all your saved trade data.

---

## Prerequisites

- Node.js and npm installed on your computer
- Trade Notebook app closed completely
- Access to PowerShell on Windows
- The Trade Notebook project folder on your computer

---

## Step-by-Step Update Process

### Step 1: Back up your trade data

Run this command to save a copy of your existing trades to your Desktop:

```powershell
Copy-Item "$env:APPDATA\Trade Notebook\trade-notebook-data.json" "$env:USERPROFILE\Desktop\trade-notebook-backup.json"
```

This ensures your data is safe even if something goes wrong.

---

### Step 2: Close the Trade Notebook app

Close the app completely. Do not just minimize it.

---

### Step 3: Navigate to the project folder

Open PowerShell and navigate to wherever you have the Trade Notebook project folder. For example:

```powershell
cd "C:\path\to\Trade-Notebook"
```

Replace `C:\path\to\Trade-Notebook` with the actual location of your project folder on your computer.

---

### Step 4: Rebuild the installer from source

Run this command to build and package the app:

```powershell
npm install; npm run dist
```

This will:
1. Install dependencies
2. Compile the latest source code
3. Generate a Windows installer

The installer location depends on your project configuration, but it is typically created in a `release` folder. Check your `package.json` file under the `"directories"` section to see where the installer will be output. By default, it may be in:

```
C:\TradeNotebookBuild\release\Trade-Notebook-Setup-<version>.exe
```

Wait for this command to complete. It may take a few minutes.

---

### Step 5: Uninstall the old version

1. Open **Windows Settings**
2. Go to **Apps** → **Installed apps**
3. Search for "Trade Notebook"
4. Click the three-dot menu and select **Uninstall**
5. **Important:** When prompted, do NOT check "Remove app data"
   - This preserves your saved trades

---

### Step 6: Install the new version

1. Open File Explorer
2. Navigate to the release folder where the installer was created (see Step 4)
3. Double-click the `.exe` file (e.g., `Trade-Notebook-Setup-1.0.0.exe`)
4. Follow the installer prompts
5. Complete the installation

---

### Step 7: Launch the app

Open Trade Notebook from:
- Windows Start Menu, or
- Desktop shortcut

---

### Step 8: Verify the update

1. Select an active session
2. Look for **Export JSON** and **Export CSV** buttons in the session header
3. If you see those buttons, the update was successful
4. Confirm your trade data is present

---

## Troubleshooting

### Export buttons are still missing

This usually means an older installer was used. Repeat steps 4–7, ensuring you use the newest `.exe` file from the release folder that was created in Step 4.

### Trade data disappeared

If your trades are missing after the update:

1. Restore from the backup you created in Step 1:

```powershell
Copy-Item "$env:USERPROFILE\Desktop\trade-notebook-backup.json" "$env:APPDATA\Trade Notebook\trade-notebook-data.json"
```

2. Restart the Trade Notebook app
3. Your trades should reappear

### Installation fails

Try these steps:

1. Make sure the app is completely closed
2. In PowerShell, run as Administrator:

```powershell
Get-Process | Where-Object { $_.Name -like "*trade*" } | Stop-Process -Force
```

3. Uninstall via Windows Settings again
4. Try running the installer again with Administrator privileges (right-click the `.exe` and select "Run as administrator")

---

## Data Storage

Your trade data is stored separately from the app and never deleted during updates:

```
%APPDATA%\Trade Notebook\trade-notebook-data.json
```

On Windows, this typically expands to:

```
C:\Users\<YourUsername>\AppData\Roaming\Trade Notebook\trade-notebook-data.json
```

As long as you do not manually delete this file or choose "Remove app data" during uninstall, your trades remain safe.

---

## Questions or Issues?

Refer to the project's [README.md](README.md) for additional information, or check the source code in the project folder for technical details.
