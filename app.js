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
  const slideoverModal = document.getElementById('slideover-modal');
  const slideoverModalOverlay = document.getElementById('slideover-modal-overlay');
  const btnCloseSlideover = document.getElementById('btn-close-slideover');

  // PiP Canvas & Video elements (Appended to DOM for Safari compliance)
  const pipCanvas = document.createElement('canvas');
  pipCanvas.width = 320;
  pipCanvas.height = 96;
  const pipCtx = pipCanvas.getContext('2d');

  const pipVideo = document.createElement('video');
  pipVideo.muted = true;
  pipVideo.playsInline = true;
  pipVideo.setAttribute('webkit-playsinline', 'true');
  pipVideo.style.position = 'fixed';
  pipVideo.style.left = '-9999px';
  pipVideo.style.top = '-9999px';
  pipVideo.style.width = '320px';
  pipVideo.style.height = '96px';
  pipVideo.style.opacity = '0.01';
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

    // 3. Render initial state to DOM & Canvas PiP
    updateCounterDOM();
    renderHistory();
    updateHistoryBadge();
    drawPipCanvas();

    // 4. Register PWA Service Worker for standalone offline usage
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('Service Worker Failed', err));
    }

    // 5. Detect client OS for Installation Modal Guides
    const ua = navigator.userAgent.toLowerCase();
    const isiOS = /ipad|iphone|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);
    if (isiOS) {
      document.body.classList.add('ios');
    } else if (isAndroid) {
      document.body.classList.add('android');
    }

    // 6. Welcome toast if resuming session
    if (count > 0) {
      showToast(`Resumed session at ${count}`);
    }

    // 7. Register Event Listeners
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

    // Trigger pop scaling animation on counter text
    if (counterValue) {
      counterValue.classList.remove('pop');
      void counterValue.offsetWidth; // Force reflow
      counterValue.classList.add('pop');
    }

    // Redraw PiP canvas in real-time
    drawPipCanvas();
  }

  // --- Live Dynamic PiP Canvas Renderer ---

  function drawPipCanvas() {
    // 1. Draw rounded container (Pitch black background)
    pipCtx.fillStyle = '#0a0a0f';
    pipCtx.fillRect(0, 0, pipCanvas.width, pipCanvas.height);
    
    // Draw thin gray border outline
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
    
    // Draw rounded rect helper
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
      // Ignore click if it targets interactive UI elements
      const isInteractive = e.target.closest('#btn-reset') ||
                            e.target.closest('#btn-history') ||
                            e.target.closest('#btn-pip') ||
                            e.target.closest('#history-drawer') ||
                            e.target.closest('#install-modal') ||
                            e.target.closest('#install-modal-overlay') ||
                            e.target.closest('#slideover-modal') ||
                            e.target.closest('#slideover-modal-overlay') ||
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
      e.stopPropagation();
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

    // E. Always-on-top Floating PiP Action
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

    // G. Close iPad Slide Over Modal
    btnCloseSlideover.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSlideOverModal();
    });

    slideoverModalOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSlideOverModal();
    });

    // G. STRICTLY Prevent Context Menu (and long-press select/zoom behaviors)
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

    const now = new Date();
    const formattedDate = formatTimestamp(now);

    const sessionLog = {
      id: Date.now().toString(),
      count: count,
      timestamp: formattedDate
    };

    history.unshift(sessionLog);
    const loggedCount = count;
    
    count = 0;
    saveState();
    
    updateCounterDOM();
    updateHistoryBadge();
    renderHistory();
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
    hours = hours ? hours : 12;
    const strHours = hours.toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  }

  // --- History Drawer UI ---

  function openDrawer() {
    historyDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
    renderHistory();
  }

  function closeDrawer() {
    historyDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
  }

  function renderHistory() {
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

  // --- Picture-in-Picture (PiP) Implementation ---

  async function togglePiP() {
    // A. Desktop Document PiP Mode (Allows fully resizable custom interactive HTML widgets)
    if ('documentPictureInPicture' in window) {
      try {
        if (window.documentPictureInPicture.window) {
          window.documentPictureInPicture.window.close();
          return;
        }

        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 96,
        });

        // Copy styles
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

        // Inject widget layout matching the phone screenshot exactly!
        const widgetContainer = pipWindow.document.createElement('div');
        widgetContainer.className = 'pip-widget-container';
        widgetContainer.innerHTML = `
          <button class="pip-close-btn">&times;</button>
          <div class="pip-value">${count}</div>
          <button class="pip-plus-btn">+</button>
        `;
        pipWindow.document.body.appendChild(widgetContainer);

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
            padding: 0 28px;
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
            font-size: 34px;
            font-weight: 700;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
          }
          .pip-plus-btn {
            background: #ffffff;
            border: none;
            color: #0a0a0f;
            font-size: 24px;
            font-weight: 700;
            width: 42px;
            height: 42px;
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

        // Click listeners in Desktop PiP window
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

        // Sync count transitions from main browser
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
    // B. Mobile Video-Canvas Stream PiP (Failsafe dynamic Canvas Stream fallback)
    else {
      try {
        // Redraw canvas with latest count before capture
        drawPipCanvas();

        // 1. Capture stream from canvas
        const stream = pipCanvas.captureStream(10); // 10 FPS is super light and battery friendly
        pipVideo.srcObject = stream;
        
        // 2. iOS Safari compliance: wait for metadata to be fully loaded before requesting PiP
        await new Promise((resolve) => {
          pipVideo.onloadedmetadata = () => {
            resolve();
          };
          if (pipVideo.readyState >= 1) {
            resolve();
          }
          // Failsafe timeout of 350ms
          setTimeout(resolve, 350);
        });

        // 3. Play the video stream and trigger browser Picture-in-Picture
        try {
          await pipVideo.play();
        } catch (playErr) {
          console.warn("Play interrupted or blocked, proceeding directly to PiP request:", playErr);
        }
        
        await pipVideo.requestPictureInPicture();

        // 4. Mobile Intercept: Tapping floating overlay plays/pauses stream. We capture this to increment count!
        let isProcessingTap = false;
        
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
          // Keep stream playing visually so it remains active
          pipVideo.play().catch(e => console.log(e));
          setTimeout(() => { isProcessingTap = false; }, 250);
        };

        showToast("Mobile Floating Counter Active!");
      } catch (err) {
        console.error("Canvas Video PiP failed:", err);
        
        // Failsafe OS sniffing: If Apple Safari on iPhone/iPad blocks dynamic streams,
        // trigger the custom iPad Slide Over Floating widget instructions instead!
        const ua = navigator.userAgent.toLowerCase();
        const isiOS = /ipad|iphone|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (isiOS) {
          openSlideOverModal();
        } else {
          // Fallback on Android / other environments: PWA installation dialog
          openInstallModal();
        }
      }
    }
  }

  // --- PWA Installation Modal Actions ---

  function openInstallModal() {
    installModal.classList.add('active');
    installModalOverlay.classList.add('active');
  }

  function closeInstallModal() {
    installModal.classList.remove('active');
    installModalOverlay.classList.remove('active');
  }

  // --- iPad Slide Over Floating Guide Modal Actions ---

  function openSlideOverModal() {
    slideoverModal.classList.add('active');
    slideoverModalOverlay.classList.add('active');
  }

  function closeSlideOverModal() {
    slideoverModal.classList.remove('active');
    slideoverModalOverlay.classList.remove('active');
  }

  // --- Toast Notifications ---

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

    setTimeout(() => {
      toast.classList.add('fade-out');
    }, 2200);

    setTimeout(() => {
      toast.remove();
    }, 2500);
  }
});
