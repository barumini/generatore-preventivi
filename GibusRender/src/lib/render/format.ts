const DATE_FORMAT = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

/** Data e ora in italiano, sempre nel fuso di Roma (il server può essere in UTC). */
export function formatDate(d: Date): string {
  return DATE_FORMAT.format(d);
}
