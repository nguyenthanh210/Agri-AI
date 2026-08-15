const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');

let mainWindow;
let expoProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  // Load the Expo web dev server
  const loadURL = () => {
    mainWindow.loadURL('http://localhost:8081').catch(() => {
      console.log('Waiting for Expo web server...');
      setTimeout(loadURL, 1000);
    });
  };
  
  loadURL();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Bật Expo dev server dưới dạng tiến trình con
  expoProcess = spawn(/^win/.test(process.platform) ? 'npx.cmd' : 'npx', ['expo', 'start', '--web', '--port', '8081'], {
    stdio: 'inherit',
    shell: true
  });

  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  if (expoProcess) {
    expoProcess.kill();
  }
});
