/* Boot. Everything runs offline from one file; the CSP in index.html blocks any network request. */
(function (U) {
  'use strict';
  window.addEventListener('error', ev => U.toast && U.toast('Kesalahan tak terduga: ' + (ev.message || ev), 'error'));
  window.addEventListener('unhandledrejection', ev => U.toast && U.toast('Kesalahan tak terduga: ' + ((ev.reason && ev.reason.message) || ev.reason), 'error'));
  function boot() {
    U.buildShell();
    U.initTheme();
    U.App.load();
    U.App.recompute();
    U.renderAll();
    U.maybeTour();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(UI);
