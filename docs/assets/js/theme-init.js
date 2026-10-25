(() => {
  let savedTheme = 'dark';

  try {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') savedTheme = storedTheme;
  } catch {}

  document.documentElement.setAttribute('data-theme', savedTheme);

  try {
    if (localStorage.getItem('loaderSeen') === '1') {
      document.documentElement.classList.add('loader-skip');
    }
  } catch {}
})();
