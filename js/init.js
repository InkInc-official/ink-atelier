// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  renderNotesList();
  renderCharaList();
  renderTagCategoryList();
  setTimeout(checkOllamaStatus, 2000);
});
