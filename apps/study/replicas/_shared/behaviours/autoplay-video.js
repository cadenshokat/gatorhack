// Muted, looping, inline autoplay video, so the copy moves the way the live page does (WebAble's "motion paused"
// then has real motion to act on). The capture removes the live stream (often a blob: URL); give the video a local
// clip of the same size, kept in replicas/<id>/site/local/.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.video selector of the video element(s)
 * @param {string} [o.src] local clip, e.g. '/_r/<id>/local/lead.mp4'
 * @param {string} [o.type] its MIME type (default from the extension)
 * @param {string} [o.poster] local poster image (the capture already sets a snapshot poster when it can)
 * @param {boolean} [o.loop] default true
 */
export function init(root, o) {
  const vids = [...root.querySelectorAll(o.video)];
  for (const v of vids) {
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.loop = o.loop !== false;
    if (v.loop) v.setAttribute('loop', '');
    v.autoplay = true;
    v.setAttribute('autoplay', '');
    if (o.poster) v.poster = o.poster;
    if (o.src) {
      v.src = o.src;
      if (o.type) v.setAttribute('type', o.type);
    }
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
  return {
    destroy() {
      for (const v of vids) v.pause();
    },
  };
}
