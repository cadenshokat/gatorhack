// Capture config for the National Weather Service 7-day forecast for Gainesville, FL on a phone (the practice page).
// Run: node scripts/capture/capture.mjs nws-gainesville && node scripts/capture/validate.mjs nws-gainesville

/** Taps a menu-bar dropdown ("FORECAST", "SAFETY"...) inside the open menu and reports what changed. */
async function tapDropdown(page, n) {
  const before = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.locator('#top-nav a.dropdown-toggle').nth(n).tap();
  await page.waitForTimeout(700);
  return page.evaluate(
    ([n, before]) => {
      const a = document.querySelectorAll('#top-nav a.dropdown-toggle')[n];
      const menu = a.parentElement.querySelector('.dropdown-menu');
      return {
        open: a.parentElement.classList.contains('open'),
        expanded: a.getAttribute('aria-expanded'),
        openMenus: document.querySelectorAll('#top-nav li.open').length,
        menuHeight: Math.round(menu.getBoundingClientRect().height),
        growth: document.documentElement.scrollHeight - before,
      };
    },
    [n, before],
  );
}

async function openMenu(page) {
  await page.locator('.navbar-toggle').tap();
  await page.waitForTimeout(800);
}

export default {
  id: 'nws-gainesville',
  // Where a search for "Gainesville, FL" on weather.gov lands.
  url: 'https://forecast.weather.gov/MapClick.php?CityName=Gainesville&state=FL&site=JAX&textField1=29.6742&textField2=-82.3363',
  // The live path is /MapClick.php. The study host serves files by their extension, so a .php file would not open as
  // a web page; /MapClick is written as MapClick.html and served by cleanUrls. The practice never runs the engine,
  // so the path has no other effect.
  servePath: '/MapClick',
  siteName: 'National Weather Service',
  sameSite: ['forecast.weather.gov'],
  licence:
    'Forecast text, graphics and images: public domain, works of the US federal government (NOAA / National Weather Service, 17 U.S.C. 105). The NOAA and NWS emblems are government insignia, used here only inside a private, non-commercial research study. Map tiles: (c) Esri and its data providers, kept as captured in a non-commercial research copy. Icons: Font Awesome 4 (OFL 1.1). Page CSS: Bootstrap 3 (MIT) and NWS styles.',
  attribution:
    'National Weather Service, "7-Day Forecast 29.67N 82.33W" (Gainesville FL), https://forecast.weather.gov/MapClick.php?CityName=Gainesville&state=FL&site=JAX&textField1=29.6742&textField2=-82.3363, forecast issued 4:26 pm EDT 27 Oct 2026. Changed: scripts removed, menu toggling re-created, files stored locally; shown as the site made it (practice).',
  stateNotes: [
    'As the site loads: menu closed, the Jacksonville office\'s "Coastal Flood Warnings" briefing at the top, the 7-day strip at its start, the map on its default Topographic basemap, the "View in Desktop Mode" bar fixed at the bottom',
    'The forecast is the one issued at 4:26 pm EDT on 27 Oct 2026; every participant sees that forecast',
    'Served at /MapClick rather than /MapClick.php (see servePath in capture.config.mjs)',
  ],
  removed: ['"View in Desktop Mode" does nothing in the copy (on the live site a script sets a cookie and reloads)'],
  // Bootstrap 3: the menu button opens #top-nav (class "in"); the menu's dropdowns are in site/page.js.
  behaviours: [
    {
      use: 'accordion',
      options: {
        trigger: '.navbar-toggle[data-toggle="collapse"]',
        panel: 'attr:data-target',
        closed: 'class',
        openClass: 'in',
        triggerClosedClass: 'collapsed',
      },
    },
  ],
  behaviourNotes: ['menu dropdowns (site/page.js)'],
  checks: [
    {
      name: 'open the menu',
      run: async (page) => {
        const before = await page.evaluate(() => document.documentElement.scrollHeight);
        await openMenu(page);
        return page.evaluate((before) => {
          const b = document.querySelector('.navbar-toggle');
          const n = document.querySelector('#top-nav');
          return {
            expanded: b.getAttribute('aria-expanded'),
            buttonCollapsed: b.classList.contains('collapsed'),
            navOpen: n.classList.contains('in'),
            navHeight: Math.round(n.getBoundingClientRect().height),
            growth: document.documentElement.scrollHeight - before,
          };
        }, before);
      },
    },
    {
      name: 'menu: open "FORECAST", then "SAFETY"',
      run: async (page) => {
        await openMenu(page);
        const first = await tapDropdown(page, 0);
        const second = await tapDropdown(page, 2);
        return Object.fromEntries([
          ...Object.entries(first).map(([k, v]) => [`forecast_${k}`, v]),
          ...Object.entries(second).map(([k, v]) => [`safety_${k}`, v]),
        ]);
      },
    },
    {
      name: 'menu: "FORECAST" twice closes it',
      run: async (page) => {
        await openMenu(page);
        await tapDropdown(page, 0);
        return tapDropdown(page, 0);
      },
    },
    {
      name: '7-day strip scrolls sideways',
      run: (page) =>
        page.evaluate(async () => {
          const c = document.querySelector('#seven-day-forecast-container');
          c.scrollTo({ left: 10000, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 300));
          return { scrollWidth: c.scrollWidth, clientWidth: c.clientWidth, scrollLeft: Math.round(c.scrollLeft) };
        }),
    },
  ],
};
