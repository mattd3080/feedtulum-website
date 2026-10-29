(() => {
  const legend = document.querySelector('.calendar-legend');
  const message = document.querySelector('#calendar-status');
  const days = [...document.querySelectorAll('.calendar td a')].map(link => {
    return { link, day: Number(link.querySelector('.day').textContent), label: link.getAttribute('aria-label') };
  });

  async function refresh() {
    try {
      const response = await fetch('/api/calendar-status', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Unavailable');
      const status = await response.json();
      if (!Array.isArray(status.filledDays) || !status.filledDays.every(day => Number.isInteger(day) && day >= 1 && day <= 31)) throw new Error('Invalid status');
      for (const { link, day, label } of days) {
        const filled = status.filledDays.includes(day);
        link.classList.toggle('is-filled', filled);
        link.setAttribute('aria-label', `${filled ? 'Filled' : 'Available'}. ${label}`);
      }
      legend.hidden = false;
      message.hidden = true;
    } catch {
      for (const { link, label } of days) {
        link.classList.remove('is-filled');
        link.setAttribute('aria-label', label);
      }
      legend.hidden = true;
      message.textContent = 'Availability is temporarily unavailable. You can still choose any amount to give.';
      message.hidden = false;
    } finally {
      window.setTimeout(refresh, 60000);
    }
  }
  refresh();
})();
