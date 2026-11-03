// PEOPLE article-page behaviours, mirroring what the site's own scripts do to the DOM (the site's CSS draws every
// state). The same file serves pp-millie and pp-karin. Listens on the document (delegation) so the engine's proxied
// clicks on the original elements work too; never stops propagation, never touches navigation.
//   - the header's menu button toggles is-fullnav on the header and has-overlay on <html> (the full-screen nav);
//   - the AppsFlyer "The PEOPLE app" banner's close button removes the banner and its spacer and sets the page's
//     --banner-height to 0px, so the fixed header moves up to the top of the screen and the page loses the banner's
//     height, as on the live page.
//   - the EX.CO video player floating at the bottom of the screen: its close button (X) hides the player. Approximation:
//     the live player's own close was not compared step by step (its in-article slot has no height, so nothing moves).
// The fixed header and the adhesive ad stay put while scrolling through the site's own CSS.

export function init(root) {
  const doc = root.ownerDocument || root;
  const off = [];
  const header = doc.querySelector('#header_1-0');

  const closeBanner = () => {
    const box = doc.querySelector('#appsflyer-banner_1-0');
    if (box) box.replaceChildren();
    doc.documentElement.style.setProperty('--banner-height', '0px');
  };

  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.mntl-header__menu-button')) {
      const open = !header?.classList.contains('is-fullnav');
      header?.classList.toggle('is-fullnav', open);
      doc.documentElement.classList.toggle('has-overlay', open);
      return;
    }
    if (t.closest('#smart-banner [data-af-close-button]')) {
      closeBanner();
      return;
    }
    const exClose = t.closest('.exp-ui__sticky__close-btn');
    if (exClose) {
      const player = exClose.closest('[data-exs-config]') ?? exClose.closest('.mm-video-exco-trending-video-player');
      if (player) player.style.display = 'none';
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
