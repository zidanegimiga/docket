export const DISPLAY_TIME_ZONE = "UTC";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
