// Health.com article-page behaviours, mirroring what the site's own scripts do to the DOM (the site's CSS draws every
// state). The same file serves every hc-* replica. Listens on the document (delegation) so the engine's proxied clicks
// on the original elements work too; never stops propagation, never touches navigation.
//   - the header's menu button toggles is-fullnav on the header and has-overlay on <html> (the full-screen nav), as on
//     the live page (live check "menu opens and closes": open is-fullnav + has-overlay, closed neither).
// The fixed header and the adhesive ad stay put while scrolling through the site's own CSS.

export function init(root) {
  const doc = root.ownerDocument || root;
  const off = [];
  const header = doc.querySelector('#header_1-0');

  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.mntl-header__menu-button')) {
      const open = !header?.classList.contains('is-fullnav');
      header?.classList.toggle('is-fullnav', open);
      doc.documentElement.classList.toggle('has-overlay', open);
    }
  };
  doc.addEventListener('click', onClick);
  off.push(() => doc.removeEventListener('click', onClick));

  return {
    destroy() {
      for (const f of off) f();
    },
  };
}
