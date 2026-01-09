// Sales Mode Service
// Manages sales mode state and provides toggle functionality

const STORAGE_KEY = 'nfg_sales_mode_enabled';

// Event listeners for sales mode changes
let changeListeners = [];

/**
 * Check if sales mode is currently enabled
 * @returns {boolean} True if sales mode is enabled
 */
export function isSalesModeEnabled() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'true';
}

/**
 * Enable sales mode
 */
export function enableSalesMode() {
  localStorage.setItem(STORAGE_KEY, 'true');
  notifyListeners(true);
}

/**
 * Disable sales mode
 */
export function disableSalesMode() {
  localStorage.setItem(STORAGE_KEY, 'false');
  notifyListeners(false);
}

/**
 * Toggle sales mode on/off
 */
export function toggleSalesMode() {
  if (isSalesModeEnabled()) {
    disableSalesMode();
  } else {
    enableSalesMode();
  }
}

/**
 * Register a callback to be called when sales mode changes
 * @param {Function} callback - Function to call when sales mode changes (receives boolean: isEnabled)
 */
export function onChanged(callback) {
  if (typeof callback === 'function') {
    changeListeners.push(callback);
  }
}

/**
 * Remove a change listener
 * @param {Function} callback - The callback function to remove
 */
export function removeChangeListener(callback) {
  changeListeners = changeListeners.filter(listener => listener !== callback);
}

/**
 * Notify all listeners of a sales mode change
 * @param {boolean} isEnabled - Whether sales mode is now enabled
 */
function notifyListeners(isEnabled) {
  changeListeners.forEach(callback => {
    try {
      callback(isEnabled);
    } catch (error) {
      console.error('Error in sales mode change listener:', error);
    }
  });
}

// Export a default object with all functions for convenience
export const salesMode = {
  isEnabled: isSalesModeEnabled,
  enable: enableSalesMode,
  disable: disableSalesMode,
  toggle: toggleSalesMode,
  onChanged: onChanged,
  removeChangeListener: removeChangeListener
};
