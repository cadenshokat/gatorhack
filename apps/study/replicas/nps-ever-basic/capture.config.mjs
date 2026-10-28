// Capture config for the NPS Everglades "Basic Information" page (family 'gov', set 'A').
// Run: node scripts/capture/capture.mjs nps-ever-basic && node scripts/capture/validate.mjs nps-ever-basic

/** Opens one Bootstrap section by its button text and reports what changed. */
async function openSection(page, label) {
  const before = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.locator('.accordion-button', { hasText: label }).tap();
  await page.waitForTimeout(700);
  return page.evaluate(
    ([label, before]) => {
      const btns = [...document.querySelectorAll('.accordion-button')];
      const b = btns.find((x) => x.textContent.includes(label));
      const p = document.getElementById(b.getAttribute('aria-controls'));
      return {
        expanded: b.getAttribute('aria-expanded'),
        buttonCollapsed: b.classList.contains('collapsed'),
        panelHeight: Math.round(p.getBoundingClientRect().height),
        growth: document.documentElement.scrollHeight - before,
        openSections: btns.filter((x) => x.getAttribute('aria-expanded') === 'true').length,
      };
    },
    [label, before],
  );
}

export default {
  id: 'nps-ever-basic',
  url: 'https://www.nps.gov/ever/planyourvisit/basicinfo.htm',
  servePath: '/ever/planyourvisit/basicinfo.htm',
  siteName: 'National Park Service',
  licence:
    'Text: public domain, a work of the US federal government (17 U.S.C. 105). The NPS Arrowhead is a protected emblem (18 U.S.C. 701); used here only inside a private, non-commercial research study. Fonts: Inter (OFL 1.1), Open Sans (Apache 2.0 / OFL), Font Awesome Free (OFL 1.1 / MIT).',
  attribution: 'National Park Service, "Basic Information - Everglades National Park (U.S. National Park Service)", https://www.nps.gov/ever/planyourvisit/basicinfo.htm',
  stateNotes: [
    'Start state as the site loads: "Physical Address" open, the other six sections closed (hidden="until-found", as live)',
    'Menu, search and chat closed; the black "Search or ask anything" chat banner shown, as live',
  ],
  // Bootstrap 5 collapse: the seven sections (one open at a time), the "Show Standard Hours" toggles, the menu and
  // its submenus, the header search.
  behaviours: [
    {
      use: 'accordion',
      options: {
        trigger: '[data-bs-toggle="collapse"]',
        panel: 'attr:data-bs-target',
        closed: 'class',
        openClass: 'show',
        triggerClosedClass: 'collapsed',
        exclusive: 'data-bs-parent',
      },
    },
  ],
  behaviourNotes: ['find-on-page (beforematch opens a section)'],
  checks: [
    { name: 'open "Operating Hours & Seasons"', run: (page) => openSection(page, 'Operating Hours') },
    { name: 'open "Fees & Passes"', run: (page) => openSection(page, 'Fees & Passes') },
    {
      name: 'Find on Page reveals "Weather"',
      run: (page) =>
        page.evaluate(async () => {
          const b = [...document.querySelectorAll('.accordion-button')].find((x) => x.textContent.includes('Weather'));
          const p = document.getElementById(b.getAttribute('aria-controls'));
          p.removeAttribute('hidden'); // what the browser does before it fires beforematch
          (p.firstElementChild || p).dispatchEvent(new Event('beforematch', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 700));
          return { expanded: b.getAttribute('aria-expanded'), panelHeight: Math.round(p.getBoundingClientRect().height) };
        }),
    },
    {
      name: 'open the menu',
      run: async (page) => {
        await page.locator('#GlobalNav-toggle').tap();
        await page.waitForTimeout(700);
        return page.evaluate(() => ({
          expanded: document.querySelector('#GlobalNav-toggle').getAttribute('aria-expanded'),
          menuHeight: Math.round(document.querySelector('#GlobalNavCollapse').getBoundingClientRect().height),
        }));
      },
    },
  ],
};
