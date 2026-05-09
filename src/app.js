/**
 * @author Luuxis / Tactician_sh
 * @license CC-BY-NC 4.0
 *
 * MAIN PROCESS — Electron entry point
 */

'use strict';

const { app, ipcMain, nativeTheme } = require('electron');
const { autoUpdater }                = require('electron-updater');
const path                           = require('path');

const {
    getWindow: getUpdateWindow,
    createWindow: createUpdateWindow,
    destroyWindow: destroyUpdateWindow
} = require('./assets/js/windows/updateWindow.js');

const {
    getWindow: getMainWindow,
    createWindow: createMainWindow,
    destroyWindow: destroyMainWindow
} = require('./assets/js/windows/mainWindow.js');

const { Microsoft } = require('minecraft-java-core');

// ── Single-instance lock ─────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}
app.on('second-instance', () => {
    const win = getMainWindow() || getUpdateWindow();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function shouldSkipUpdater() {
    return process.env.NODE_ENV === 'dev' ||
           (process.platform === 'linux' && !process.env.APPIMAGE);
}

// ── App ready ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    createUpdateWindow();

    if (shouldSkipUpdater()) {
        console.log('[AutoUpdater] Skip — dev ou Linux non-AppImage');
        // On attend que la fenêtre soit prête avant d'envoyer l'événement
        const win = getUpdateWindow();
        if (win?.webContents.isLoading()) {
            win.webContents.once('did-finish-load', () => {
                getUpdateWindow()?.webContents.send('update-not-available');
            });
        } else {
            getUpdateWindow()?.webContents.send('update-not-available');
        }
        return;
    }

    autoUpdater.checkForUpdates().catch(err => {
        console.error('[AutoUpdater]', err.message);
        getUpdateWindow()?.webContents.send('error', err);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ── Auto-updater ─────────────────────────────────────────────────────────────
autoUpdater.autoDownload = false;

autoUpdater.on('update-available',     ()         => { 
  getUpdateWindow()?.webContents.send('updateAvailable');
  console.log("AHHAHAH");
});
autoUpdater.on('update-not-available', ()         => getUpdateWindow()?.webContents.send('update-not-available'));
autoUpdater.on('error',                (err)      => getUpdateWindow()?.webContents.send('error', err));
autoUpdater.on('download-progress',    (progress) => getUpdateWindow()?.webContents.send('download-progress', progress));
autoUpdater.on('update-downloaded',    ()         => autoUpdater.quitAndInstall(false, true));

// ── IPC — updater ────────────────────────────────────────────────────────────

// ── IPC — Microsoft OAuth ────────────────────────────────────────────────────
ipcMain.handle('Microsoft-window', async (event, client_id) => {
    let msAuth = new Microsoft(client_id);
    let account;

    try {
        account = await msAuth.getAuth();
    } catch (err) {
        // L'utilisateur a fermé la fenêtre ou annulé
        return 'cancel';
    }

    if (!account || account.error) return 'cancel';
    return account;
});

// index.js uses ipcRenderer.invoke('update-app') → must be ipcMain.handle
ipcMain.handle('update-app', async () => {
    if (shouldSkipUpdater()) {
        setTimeout(() => getUpdateWindow()?.webContents.send('update-not-available'), 0);
        return null;
    }
    return autoUpdater.checkForUpdates().catch(err => { throw err; });
});

ipcMain.on('start-update',               () => autoUpdater.downloadUpdate());
ipcMain.on('update-window-close',        () => { destroyUpdateWindow(); });
ipcMain.on('update-window-dev-tools',    () => getUpdateWindow()?.webContents.toggleDevTools());

ipcMain.on('update-window-progress', (e, { progress, size }) => {
    if (progress && size) getUpdateWindow()?.setProgressBar(progress / size);
});
ipcMain.on('update-window-progress-load',  () => getUpdateWindow()?.setProgressBar(2, { mode: 'indeterminate' }));
ipcMain.on('update-window-progress-reset', () => getUpdateWindow()?.setProgressBar(-1));

// ── IPC — main window ────────────────────────────────────────────────────────
ipcMain.on('main-window-open', () => {
    createMainWindow();        // créer d'abord
    destroyUpdateWindow();     // détruire ensuite (évite window-all-closed prématuré)
});

ipcMain.on('main-window-close',          () => { destroyMainWindow(); app.quit(); });
ipcMain.on('main-window-minimize',       () => getMainWindow()?.minimize());
ipcMain.on('main-window-maximize',       () => {
    const win = getMainWindow();
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('main-window-hide',           () => getMainWindow()?.hide());
ipcMain.on('main-window-show',           () => getMainWindow()?.show());
ipcMain.on('main-window-dev-tools',      () => getMainWindow()?.webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('main-window-dev-tools-close',() => getMainWindow()?.webContents.closeDevTools());

ipcMain.on('main-window-progress', (e, { progress, size }) => {
    if (progress && size) getMainWindow()?.setProgressBar(progress / size);
});
ipcMain.on('main-window-progress-load',  () => getMainWindow()?.setProgressBar(2, { mode: 'indeterminate' }));
ipcMain.on('main-window-progress-reset', () => getMainWindow()?.setProgressBar(-1));

// ── IPC — utilities ──────────────────────────────────────────────────────────

// database.js: `${path-user-data}${dev ? '../..' : '/databases'}`
// In dev the sqlite file ends up at <userData>/../../databases → project root /databases
ipcMain.handle('path-user-data', () => app.getPath('userData') + '/');

// utils.js / settings.js use appdata() → ipcRenderer.invoke('appData')
ipcMain.handle('appData', () => app.getPath('appData'));

ipcMain.handle('is-dark-theme', (e, theme) => {
    if (theme === 'dark')  return true;
    if (theme === 'light') return false;
    return nativeTheme.shouldUseDarkColors;
});
