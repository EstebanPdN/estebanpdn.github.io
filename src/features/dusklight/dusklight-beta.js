const form = document.querySelector('#beta-report');
const status = form.querySelector('.beta-status');
const progress = form.querySelector('progress');
const button = form.querySelector('button');
const endpoint = 'https://estebansforge.estebanpdn.chatgpt.site/api/dusklight/dumps';

function showStatus(message, error = false) {
  status.textContent = message;
  status.toggleAttribute('data-error', error);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (button.disabled) return;
  const fields = new FormData(form);
  const file = fields.get('dump');
  const username = fields.get('username').trim();
  const description = fields.get('description').trim();
  if (!username || !description) {
    showStatus('Enter a username and describe the issue.', true);
    return;
  }
  if (!file.size || !/\.zip$/i.test(file.name)) {
    showStatus('Choose one non-empty ZIP file.', true);
    return;
  }
  if (file.size > 50_000_000) {
    showStatus('The ZIP exceeds 50 MB.', true);
    return;
  }

  const report = { username, category: fields.get('category'), description };
  const xhr = new XMLHttpRequest();
  xhr.open('POST', endpoint);
  xhr.setRequestHeader('Content-Type', 'application/zip');
  xhr.setRequestHeader('X-Dump-Consent', 'yes');
  xhr.setRequestHeader('X-Dump-Report', encodeURIComponent(JSON.stringify(report)));
  xhr.responseType = 'json';
  for (const field of form.elements) field.disabled = true;
  progress.value = 0;
  progress.hidden = false;
  showStatus('Uploading…');
  xhr.upload.addEventListener('progress', (update) => {
    if (update.lengthComputable) progress.value = (100 * update.loaded) / update.total;
  });

  const abort = () => xhr.abort();
  scope.signal.addEventListener('abort', abort, { once: true });
  xhr.addEventListener('loadend', () => {
    scope.signal.removeEventListener('abort', abort);
    for (const field of form.elements) field.disabled = false;
    progress.hidden = true;
    if (scope.signal.aborted) {
      showStatus('');
    } else if (xhr.status === 201 && xhr.response?.id) {
      form.reset();
      showStatus(`Dump received. Receipt ${xhr.response.id}`);
    } else {
      showStatus(xhr.response?.message || 'The dump could not be sent. Try again.', true);
    }
  });
  xhr.send(file);
});
