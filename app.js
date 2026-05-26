/* ==========================================================================
   Premium Minimalist Counter Web App - Core Logic Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const appContainer = document.getElementById('app-container');
  const counterValue = document.getElementById('counter-value');
  const btnReset = document.getElementById('btn-reset');
  const btnHistory = document.getElementById('btn-history');
  const historyBadge = document.getElementById('history-badge');
  const historyDrawer = document.getElementById('history-drawer');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const historyList = document.getElementById('history-list');
  const noHistoryMsg = document.getElementById('no-history-msg');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const toastContainer = document.getElementById('toast-container');




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
      timestamp: formattedDate,
      note: ''
    };

    history.unshift(sessionLog);
    const loggedCount = count;
    
    count = 0;
    saveState();
    
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
        <div class="history-item-main">
          <div class="history-item-details">
            <div class="history-item-count">${item.count}</div>
            <div class="history-item-time">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>${item.timestamp}</span>
            </div>
          </div>
          <div class="history-item-note-container">
            <textarea class="history-item-note" placeholder="Add a note..." rows="1">${item.note || ''}</textarea>
          </div>
        </div>
        <button class="delete-item-btn" aria-label="Delete this session">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      `;

      const noteTextarea = li.querySelector('.history-item-note');
      if (noteTextarea) {
        autoGrowTextarea(noteTextarea);
        setTimeout(() => autoGrowTextarea(noteTextarea), 50);

        noteTextarea.addEventListener('input', () => {
          item.note = noteTextarea.value;
          saveState();
          autoGrowTextarea(noteTextarea);
        });

        noteTextarea.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
        });
      }

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

  // --- Auto-growing Textarea Helper ---
  function autoGrowTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
});
