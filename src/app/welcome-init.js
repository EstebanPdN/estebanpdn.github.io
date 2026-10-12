// Detail-page return links go directly to the requested portfolio section.
if (!['#collection', '#progress', '#info'].includes(location.hash)) {
  try {
    if (localStorage.getItem('forge-welcome-seen-v1') !== '1')
      document.documentElement.classList.add('welcome-pending');
  } catch {
    document.documentElement.classList.add('welcome-pending');
  }
}
