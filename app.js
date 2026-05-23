/* ==========================================================================
   Premium Minimalist Counter Web App - Core Logic Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const appContainer = document.getElementById('app-container');
  const counterValue = document.getElementById('counter-value');
  const btnReset = document.getElementById('btn-reset');
  const btnHistory = document.getElementById('btn-history');
  const btnPip = document.getElementById('btn-pip');
  const historyBadge = document.getElementById('history-badge');
  const historyDrawer = document.getElementById('history-drawer');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const historyList = document.getElementById('history-list');
  const noHistoryMsg = document.getElementById('no-history-msg');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const toastContainer = document.getElementById('toast-container');
  const installModal = document.getElementById('install-modal');
  const installModalOverlay = document.getElementById('install-modal-overlay');
  const btnCloseModal = document.getElementById('btn-close-modal');

  // Canvas and Video elements for Mobile PiP Live Stream
  const pipCanvas = document.createElement('canvas');
  pipCanvas.width = 320;
  pipCanvas.height = 96;
  const pipCtx = pipCanvas.getContext('2d');
  
  const pipVideo = document.createElement('video');
  pipVideo.muted = true;
  pipVideo.playsInline = true;
  pipVideo.setAttribute('webkit-playsinline', 'true');
  pipVideo.style.position = 'fixed';
  pipVideo.style.width = '1px';
  pipVideo.style.height = '1px';
  pipVideo.style.opacity = '0';
  pipVideo.style.pointerEvents = 'none';
  document.body.appendChild(pipVideo);

  // Application State
  let count = 0;
  let history = [];

  // Initialize App
  init();

  function init() {
    // 1. Load active count from localStorage
    const savedCount = localStorage.getItem('activeCount');
    if (savedCount !== null) {
      count = parseInt(savedCount, 10);
      if (isNaN(count)) count = 0;
    }

    // 2. Load history array from localStorage
    const savedHistory = localStorage.getItem('counterHistory');
    if (savedHistory !== null) {
      try {
        history = JSON.parse(savedHistory);
        if (!Array.isArray(history)) history = [];
      } catch (e) {
        history = [];
      }
    }

    // 3. Render initial state to the DOM
    updateCounterDOM();
    renderHistory();
    updateHistoryBadge();

    // 4. Welcome back toast if there was a running session
    if (count > 0) {
      showToast(`Resumed session at ${count}`);
    }

    // 5. Register PWA Service Worker for standalone App Mode capability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('PWA Service Worker Registered'))
        .catch(err => console.log('PWA Service Worker Registration Failed', err));
    }

    // 6. Detect client OS for Custom Installation Guide
    const ua = navigator.userAgent.toLowerCase();
    const isiOS = /ipad|iphone|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);
    if (isiOS) {
      document.body.classList.add('ios');
    } else if (isAndroid) {
      document.body.classList.add('android');
    }

    // 7. Render initial state to the Canvas PiP stream
    drawPipCanvas();

    // 6. Register Event Listeners
    registerEventListeners();
  }

  // --- Core State Updates ---

  function updateCounterDOM() {
    counterValue.textContent = count;
  }

  // --- Unified Counter Incrementer ---

  function incrementCount() {
    count++;
    saveState();
    updateCounterDOM();

    // Trigger pop animation on counter text
    if (counterValue) {
      counterValue.classList.remove('pop');
      void counterValue.offsetWidth; // Force reflow
      counterValue.classList.add('pop');
    }

    // Redraw PiP canvas in real-time
    drawPipCanvas();
  }

  // --- Dynamic Live PiP Canvas Renderer ---

  function drawPipCanvas() {
    // 1. Clear & Draw Rounded Rectangle Background
    pipCtx.fillStyle = '#0a0a0f'; // Pitch black
    pipCtx.fillRect(0, 0, pipCanvas.width, pipCanvas.height);
    
    // Draw thin gray border
    pipCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    pipCtx.lineWidth = 2;
    pipCtx.strokeRect(1, 1, pipCanvas.width - 2, pipCanvas.height - 2);

    // 2. Draw close symbol '×' on the left
    pipCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    pipCtx.font = '28px "Outfit", "Inter", sans-serif';
    pipCtx.textAlign = 'center';
    pipCtx.textBaseline = 'middle';
    pipCtx.fillText('×', 40, pipCanvas.height / 2);

    // 3. Draw Count Value in the center
    pipCtx.fillStyle = '#ffffff';
    pipCtx.font = 'bold 36px "Outfit", "Inter", sans-serif';
    pipCtx.textAlign = 'center';
    pipCtx.textBaseline = 'middle';
    pipCtx.fillText(count.toString(), pipCanvas.width / 2, pipCanvas.height / 2);

    // 4. Draw Plus button '+' on the right (White rounded box with black '+')
    const boxSize = 42;
    const boxX = pipCanvas.width - 40 - boxSize / 2;
    const boxY = pipCanvas.height / 2 - boxSize / 2;
    
    // Draw white rounded box
    pipCtx.fillStyle = '#ffffff';
    pipCtx.beginPath();
    const radius = 10;
    pipCtx.moveTo(boxX + radius, boxY);
    pipCtx.lineTo(boxX + boxSize - radius, boxY);
    pipCtx.quadraticCurveTo(boxX + boxSize, boxY, boxX + boxSize, boxY + radius);
    pipCtx.lineTo(boxX + boxSize, boxY + boxSize - radius);
    pipCtx.quadraticCurveTo(boxX + boxSize, boxY + boxSize, boxX + boxSize - radius, boxY + boxSize);
    pipCtx.lineTo(boxX + radius, boxY + boxSize);
    pipCtx.quadraticCurveTo(boxX, boxY + boxSize, boxX, boxY + boxSize - radius);
    pipCtx.lineTo(boxX, boxY + radius);
    pipCtx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    pipCtx.closePath();
    pipCtx.fill();

    // Plus text inside the box
    pipCtx.fillStyle = '#0a0a0f';
    pipCtx.font = 'bold 24px "Outfit", "Inter", sans-serif';
    pipCtx.textAlign = 'center';
    pipCtx.textBaseline = 'middle';
    pipCtx.fillText('+', boxX + boxSize / 2, boxY + boxSize / 2);
  }

  function updateHistoryBadge() {
    historyBadge.textContent = history.length;
    if (history.length > 0) {
      historyBadge.style.display = 'inline-block';
    } else {
      historyBadge.style.display = 'none';
    }
  }

  function saveState() {
    localStorage.setItem('activeCount', count);
    localStorage.setItem('counterHistory', JSON.stringify(history));
  }

  // --- Event Handling ---

  function registerEventListeners() {
    // A. Main Touch/Click Anywhere to Increment
    appContainer.addEventListener('pointerdown', (e) => {
      // Ignore click if it targets interactive UI panels or buttons
      const isInteractive = e.target.closest('#btn-reset') ||
                            e.target.closest('#btn-history') ||
                            e.target.closest('#btn-pip') ||
                            e.target.closest('#history-drawer') ||
                            e.target.closest('#install-modal') ||
                            e.target.closest('#install-modal-overlay') ||
                            e.target.closest('.toast-container') ||
                            e.target.closest('#drawer-overlay') ||
                            e.target.closest('.close-btn') ||
                            e.target.closest('.delete-item-btn');

      if (isInteractive) return;

      // Increment count
      incrementCount();


    });

    // B. Reset and Archive Session
    btnReset.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent counting on click
      archiveCurrentSession();
    });

    // C. History Drawer Toggle
    btnHistory.addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawer();
    });

    btnCloseDrawer.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });

    drawerOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });

    // D. Clear All History
    btnClearHistory.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAllHistory();
    });

    // E. Always-on-top PiP Action (Desktop & Mobile)
    btnPip.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePiP();
    });

    // F. Close PWA Install Modal
    btnCloseModal.addEventListener('click', (e) => {
      e.stopPropagation();
      closeInstallModal();
    });

    installModalOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeInstallModal();
    });

    // E. STRICTLY Prevent Context Menu (and long-press select/zoom behaviors)
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Prevent double-tap zoom natively
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  }



  // --- Session Archive (Reset Logic) ---

  function archiveCurrentSession() {
    if (count === 0) {
      showToast("Counter is already at 0");
      return;
    }

    // Format current date and time beautifully
    // e.g. "22 May 2026, 02:45 AM"
    const now = new Date();
    const formattedDate = formatTimestamp(now);

    const sessionLog = {
      id: Date.now().toString(),
      count: count,
      timestamp: formattedDate
    };

    // Add to the front of the array (newest first)
    history.unshift(sessionLog);
    
    // Save previous count
    const loggedCount = count;
    
    // Reset state
    count = 0;
    saveState();
    
    // Update DOM
    updateCounterDOM();
    updateHistoryBadge();
    renderHistory();
    
    // Update Canvas stream
    drawPipCanvas();

    showToast(`Saved session with ${loggedCount} counts!`);
  }

  // Helper to format date cleanly
  function formatTimestamp(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' should be '12'
    const strHours = hours.toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  }

  // --- History Drawer UI ---

  function openDrawer() {
    historyDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    renderHistory(); // Refresh view
  }

  function closeDrawer() {
    historyDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
  }

  function renderHistory() {
    // Clear list
    historyList.innerHTML = '';

    if (history.length === 0) {
      noHistoryMsg.style.display = 'flex';
      btnClearHistory.style.display = 'none';
      return;
    }

    noHistoryMsg.style.display = 'none';
    btnClearHistory.style.display = 'flex';

    history.forEach((item) => {
      const li = document.createElement('li');
      li.classList.add('history-item');

      li.innerHTML = `
        <div class="history-item-details">
          <div class="history-item-count">${item.count}</div>
          <div class="history-item-time">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${item.timestamp}</span>
          </div>
        </div>
        <button class="delete-item-btn" aria-label="Delete this session">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      `;

      // Event listener for delete button
      const deleteBtn = li.querySelector('.delete-item-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
      });

      historyList.appendChild(li);
    });
  }

  function deleteHistoryItem(id) {
    history = history.filter(item => item.id !== id);
    saveState();
    updateHistoryBadge();
    renderHistory();
    showToast("Session log removed");
  }

  function clearAllHistory() {
    if (confirm("Are you sure you want to clear all history? This action cannot be undone.")) {
      history = [];
      saveState();
      updateHistoryBadge();
      renderHistory();
      showToast("All history cleared");
    }
  }

  // --- Toast System ---

  function showToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Fade out phase
    setTimeout(() => {
      toast.classList.add('fade-out');
    }, 2200);

    // Destruction phase
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  // --- Document Picture-in-Picture logic ---

  async function togglePiP() {
    // A. Desktop Document PiP Mode
    if ('documentPictureInPicture' in window) {
      try {
        if (window.documentPictureInPicture.window) {
          window.documentPictureInPicture.window.close();
          return;
        }

        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 340,
          height: 120,
        });

        // Copy stylesheets
        const allStylesheets = Array.from(document.styleSheets);
        allStylesheets.forEach((stylesheet) => {
          try {
            const cssRules = Array.from(stylesheet.cssRules).map(r => r.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = stylesheet.href;
            pipWindow.document.head.appendChild(link);
          }
        });

        // Copy fonts preconnect tags
        Array.from(document.querySelectorAll('link[rel="preconnect"]')).forEach((link) => {
          pipWindow.document.head.appendChild(link.cloneNode(true));
        });

        // Create a custom desktop widget layout matching their screenshot
        const widgetContainer = pipWindow.document.createElement('div');
        widgetContainer.className = 'pip-widget-container';
        widgetContainer.innerHTML = `
          <button class="pip-close-btn">&times;</button>
          <div class="pip-value">${count}</div>
          <button class="pip-plus-btn">+</button>
        `;

        pipWindow.document.body.appendChild(widgetContainer);

        // Inject widget stylesheet specifically for desktop Document PiP
        const widgetStyle = pipWindow.document.createElement('style');
        widgetStyle.textContent = `
          body {
            margin: 0;
            background-color: #050508;
            color: #ffffff;
            font-family: 'Outfit', 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
            user-select: none;
            -webkit-user-select: none;
          }
          .pip-widget-container {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 32px;
            box-sizing: border-box;
            background: #0a0a0f;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
          }
          .pip-close-btn {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.4);
            font-size: 28px;
            cursor: pointer;
            padding: 8px;
            transition: all 0.2s;
          }
          .pip-close-btn:hover {
            color: #ffffff;
          }
          .pip-value {
            font-size: 38px;
            font-weight: 700;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
          }
          .pip-plus-btn {
            background: #ffffff;
            border: none;
            color: #0a0a0f;
            font-size: 24px;
            font-weight: 700;
            width: 44px;
            height: 44px;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.2s;
          }
          .pip-plus-btn:active {
            transform: scale(0.95);
          }
        `;
        pipWindow.document.head.appendChild(widgetStyle);

        // Click listeners inside Document PiP window
        const closeBtn = widgetContainer.querySelector('.pip-close-btn');
        const plusBtn = widgetContainer.querySelector('.pip-plus-btn');
        const pipVal = widgetContainer.querySelector('.pip-value');

        closeBtn.addEventListener('click', () => {
          pipWindow.close();
        });

        plusBtn.addEventListener('click', () => {
          incrementCount();
          pipVal.textContent = count;
        });

        // Sync count changes from main window to PiP window
        const interval = setInterval(() => {
          if (pipVal) pipVal.textContent = count;
        }, 100);

        pipWindow.addEventListener('pagehide', () => {
          clearInterval(interval);
          showToast("Floating Mode Closed");
        });

        showToast("Desktop Always-on-top Widget Active!");
      } catch (err) {
        console.error("Document PiP failed:", err);
        showToast("Failed to launch floating widget");
      }
    }
    // B. Mobile Video-Canvas Stream Fallback (iPad / Android / iPhone)
    else {
      try {
        // Redraw canvas with latest count
        drawPipCanvas();

        // Capture canvas stream
        const stream = pipCanvas.captureStream(10); // 10 FPS
        pipVideo.srcObject = stream;
        
        await pipVideo.play();
        await pipVideo.requestPictureInPicture();

        // Listen for taps inside floating PiP on mobile to increment!
        let isProcessingTap = false;
        
        // Remove old listeners to avoid stacking
        pipVideo.onplay = () => {
          if (isProcessingTap) return;
          isProcessingTap = true;
          incrementCount();
          setTimeout(() => { isProcessingTap = false; }, 250);
        };
        pipVideo.onpause = () => {
          if (isProcessingTap) return;
          isProcessingTap = true;
          incrementCount();
          // Force resume playing to keep the widget live visually
          pipVideo.play().catch(e => console.log(e));
          setTimeout(() => { isProcessingTap = false; }, 250);
        };

        showToast("Mobile Floating Counter Active!");
      } catch (err) {
        console.error("Canvas Video PiP failed:", err);
        // Fallback to custom PWA install guide modal
        openInstallModal();
      }
    }
  }

  // --- PWA Custom Installation Guide Modal Actions ---

  function openInstallModal() {
    installModal.classList.add('active');
    installModalOverlay.classList.add('active');
  }

  function closeInstallModal() {
    installModal.classList.remove('active');
    installModalOverlay.classList.remove('active');
  }
});
