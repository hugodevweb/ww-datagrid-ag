// Inline SVG markup for the per-column-type header icons.
// Sourced from the Lucide icon pack (https://lucide.dev, ISC licensed), kept
// inline to avoid adding a runtime dependency — mirroring the approach used in
// navigationIcons.js. All icons use a 24x24 viewBox, fill="none" and
// stroke="currentColor" so they scale with font-size and inherit the header
// text color.

const SVG_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"';

const svg = (body) => `<svg ${SVG_ATTRS}>${body}</svg>`;

// Lucide icon inner markup keyed by the column's cellDataType.
const ICONS = {
  // text (Lucide "type")
  text: svg(
    '<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>'
  ),
  // number (Lucide "hash")
  number: svg(
    '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/>' +
    '<line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>'
  ),
  // currency (Lucide "circle-dollar-sign")
  currency: svg(
    '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>'
  ),
  // boolean (Lucide "square-check")
  boolean: svg(
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>'
  ),
  // date (Lucide "calendar")
  dateString: svg(
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'
  ),
  // date + time (Lucide "calendar-clock")
  dateTime: svg(
    '<path d="M16 14v2.2l1.6 1"/><path d="M16 2v4"/>' +
    '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/>' +
    '<path d="M3 10h5"/><path d="M8 2v4"/><circle cx="16" cy="16" r="6"/>'
  ),
  // select (Lucide "list")
  select: svg(
    '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/>' +
    '<path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>'
  ),
  // user (Lucide "circle-user")
  user: svg(
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/>' +
    '<path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>'
  ),
  // record / relation (Lucide "link")
  record: svg(
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  ),
  // email (Lucide "at-sign")
  email: svg(
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>'
  ),
  // link (Lucide "external-link")
  link: svg(
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/>' +
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
  ),
  // phone (Lucide "phone")
  phone: svg(
    '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>'
  ),
  // image (Lucide "image")
  image: svg(
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/>' +
    '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
  ),
  // custom (Lucide "puzzle")
  custom: svg(
    '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>'
  ),
  // action (Lucide "mouse-pointer-click")
  action: svg(
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/>' +
    '<path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>'
  ),
};

/**
 * Return the inline SVG markup for a given column cellDataType.
 * Falls back to the text icon for unknown / undefined types so every column
 * gets a sensible icon.
 *
 * @param {string} cellDataType - The column's cellDataType
 * @returns {string} Inline SVG markup
 */
export function getColumnTypeIcon(cellDataType) {
  return ICONS[cellDataType] || ICONS.text;
}
