// Bootstrap 3 dropdowns in the open menu ("FORECAST", "PAST WEATHER"...): a tap opens that one (closing any other)
// by adding "open" to its <li>, a second tap closes it, and a tap anywhere else closes it, as on the live site.
// Written by hand for replicas/nws-gainesville; capture imports it after the shared behaviours.

const TOGGLE = 'a[data-toggle="dropdown"]';

export function init(root) {
  const closeAll = (except) => {
    for (const li of root.querySelectorAll('li.open')) {
      if (li === except) continue;
      li.classList.remove('open');
      li.querySelector(TOGGLE)?.setAttribute('aria-expanded', 'false');
    }
  };
  const onClick = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const a = target.closest(TOGGLE);
    if (!a || !root.contains(a)) {
      closeAll(null);
      return;
    }
    e.preventDefault();
    const li = a.parentElement;
    const open = !li.classList.contains('open');
    closeAll(li);
    li.classList.toggle('open', open);
    a.setAttribute('aria-expanded', String(open));
  };
  root.addEventListener('click', onClick);
  return {
    destroy() {
      root.removeEventListener('click', onClick);
    },
  };
}
