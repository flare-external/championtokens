// ============================================================
//  CHAMPION TOKENS — Source Shield & Anti-Tamper Security
// ============================================================
(function() {
  'use strict';

  // 1. Console Security Notice
  if (typeof console !== 'undefined') {
    const titleStyle = 'color:#f59e0b;font-size:22px;font-weight:900;text-shadow:0 0 10px rgba(245,158,11,0.5);';
    const subStyle = 'color:#94a3b8;font-size:12px;line-height:1.5;';
    const warnStyle = 'color:#ef4444;font-size:13px;font-weight:bold;';
    
    console.log('%c🛡️ CHAMPION TOKENS SECURITY', titleStyle);
    console.log('%cThis browser feature is intended for developers. Any attempt to reverse-engineer, scrape, or inject unauthorized scripts violates the Terms of Service and will trigger an automated account ban.', subStyle);
    console.log('%cDo NOT paste any untrusted code here.', warnStyle);
  }

  // 2. Disable Context Menu (Right Click) on non-input elements
  document.addEventListener('contextmenu', function(e) {
    const tag = e.target.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && !e.target.isContentEditable) {
      e.preventDefault();
      return false;
    }
  }, { passive: false });

  // 3. Block Source Inspection & DevTools Keyboard Shortcuts
  document.addEventListener('keydown', function(e) {
    // F12 (DevTools)
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      return false;
    }

    // Ctrl+U or Cmd+U (View Page Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I or Cmd+Opt+I (Inspect Element)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+J or Cmd+Opt+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+C or Cmd+Opt+C (Inspect DOM element)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
      e.preventDefault();
      return false;
    }

    // Ctrl+S or Cmd+S (Save Webpage)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
      e.preventDefault();
      return false;
    }
  }, { passive: false });

  // 4. Drag Protection for Sensitive Graphics
  document.addEventListener('dragstart', function(e) {
    if (e.target && e.target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  }, { passive: false });

})();
