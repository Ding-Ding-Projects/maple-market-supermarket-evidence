(() => {
  'use strict';

  const source = document.getElementById('game-description-copy');
  const button = document.getElementById('copy-game-description');
  const status = document.getElementById('game-description-copy-status');
  if (!source || !button || !status) return;

  const selectForManualCopy = () => {
    source.focus();
    source.select();
    source.setSelectionRange(0, source.value.length);
    status.textContent = 'Clipboard unavailable. The description is selected so you can copy it with your keyboard. / 無法存取剪貼簿，介紹內容已選取，可以用鍵盤複製。';
  };

  button.addEventListener('click', async () => {
    if (!source.value.trim()) {
      status.textContent = 'Description is unavailable. / 暫時未有介紹內容。';
      return;
    }

    status.textContent = 'Copying description... / 正在複製介紹……';
    try {
      if (!window.isSecureContext || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        selectForManualCopy();
        return;
      }
      await navigator.clipboard.writeText(source.value);
      status.textContent = 'Description copied. / 介紹已複製。';
    } catch (_error) {
      selectForManualCopy();
    }
  });
})();
