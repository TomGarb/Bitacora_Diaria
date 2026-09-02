/**
 * Login JS - Interacciones del formulario de autenticación
 */
document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Selector rápido de usuarios demo
  document.querySelectorAll('.demo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const user = chip.dataset.username;
      const pass = chip.dataset.password || 'demo123';
      
      if (usernameInput) usernameInput.value = user;
      if (passwordInput) passwordInput.value = pass;

      // Resaltar feedback
      chip.style.borderColor = 'var(--primary)';
      setTimeout(() => {
        chip.style.borderColor = 'var(--border-color)';
      }, 500);
    });
  });
});
