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
      let counts = status.supporterCounts;
      // Older cached responses can briefly outlive a deployment.
      if (counts === undefined && Array.isArray(status.filledDays) && status.filledDays.every(day => Number.isInteger(day) && day >= 1 && day <= 31)) counts = Object.fromEntries(status.filledDays.map(day => [day, 1]));
      if (!counts || typeof counts !== 'object' || Array.isArray(counts) || !Object.entries(counts).every(([day, count]) => /^(?:[1-9]|[12][0-9]|3[01])$/.test(day) && Number.isSafeInteger(count) && count >= 0)) throw new Error('Invalid status');
      for (const { link, day, label } of days) {
        const count = counts[day] ?? 0;
        for (let level = 1; level <= 3; level++) link.classList.toggle(`supporters-${level}`, Math.min(count, 3) === level);
        const summary = `${count} monthly supporter${count === 1 ? '' : 's'}`;
        link.setAttribute('aria-label', `${summary}. ${label}`);
        link.setAttribute('title', summary);
      }
      legend.hidden = false;
      message.hidden = true;
    } catch {
      for (const { link, label } of days) {
        for (let level = 1; level <= 3; level++) link.classList.remove(`supporters-${level}`);
        link.setAttribute('aria-label', label);
        link.removeAttribute('title');
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
