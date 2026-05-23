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

    // 7. Fallback PiP button to Fullscreen if Document PiP is unsupported (e.g. iPad, iPhone, Safari)
    if (!('documentPictureInPicture' in window)) {
      const btnText = btnPip.querySelector('.btn-text');
      if (btnText) btnText.textContent = 'Fullscreen';
      
      const svgIcon = btnPip.querySelector('svg');
      if (svgIcon) {
        svgIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
        `;
      }
    }

    // 8. If already running in PWA standalone mode (installed on Home Screen), hide the PiP/Fullscreen button entirely
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      btnPip.style.display = 'none';
    }

    // 6. Register Event Listeners
    registerEventListeners();
  }

  // --- Core State Updates ---

  function updateCounterDOM() {
    counterValue.textContent = count;
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
      count++;
      saveState();
      updateCounterDOM();

      // Trigger pop animation on counter text
      counterValue.classList.remove('pop');
      void counterValue.offsetWidth; // Force DOM reflow to restart CSS animation
      counterValue.classList.add('pop');


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

    // E. PiP / Fullscreen Action
    btnPip.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePipOrFullscreen();
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
    try {
      // Check if there is already an active PiP window
      if (window.documentPictureInPicture && window.documentPictureInPicture.window) {
        window.documentPictureInPicture.window.close();
        return;
      }

      // Open PiP window
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 380,
        height: 600,
      });

      // Copy stylesheets
      const allStylesheets = Array.from(document.styleSheets);
      allStylesheets.forEach((stylesheet) => {
        try {
          const cssRules = Array.from(stylesheet.cssRules)
            .map((rule) => rule.cssText)
            .join('');
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

      // Copy Google Fonts preconnect tags
      Array.from(document.querySelectorAll('link[rel="preconnect"]')).forEach((link) => {
        pipWindow.document.head.appendChild(link.cloneNode(true));
      });

      // Move the app container to PiP
      pipWindow.document.body.appendChild(appContainer);

      // Hide PiP button inside the PiP window to prevent nested PiP calls
      const pipButtonInPiP = pipWindow.document.getElementById('btn-pip');
      if (pipButtonInPiP) {
        pipButtonInPiP.style.display = 'none';
      }

      // Restore when PiP window closes
      pipWindow.addEventListener('pagehide', () => {
        document.body.appendChild(appContainer);
        showToast("Returned from Floating Mode");
      });

      showToast("Floating Always-on-top Mode Active!");
    } catch (err) {
      console.error("Failed to enter Picture-in-Picture mode:", err);
      showToast("Failed to open Floating Mode");
    }
  }

  // --- Route PiP or Fullscreen based on browser support ---

  function handlePipOrFullscreen() {
    if ('documentPictureInPicture' in window) {
      togglePiP();
    } else {
      toggleFullscreen();
    }
  }

  // --- HTML5 Fullscreen API toggle with PWA Installer Fallback ---

  async function toggleFullscreen() {
    try {
      const docEl = document.documentElement;
      const isFullscreen = document.fullscreenElement || 
                           document.webkitFullscreenElement || 
                           document.mozFullScreenElement || 
                           document.msFullscreenElement;

      if (!isFullscreen) {
        // Enter Fullscreen with multi-browser checks
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) { /* iPadOS & iOS Safari */
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        } else {
          // Robust PWA instructions popup modal if native fullscreen is unsupported (iPhone)
          openInstallModal();
        }
      } else {
        // Exit Fullscreen with multi-browser checks
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen request rejected, launching PWA Installation guide instead:", err);
      openInstallModal();
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
