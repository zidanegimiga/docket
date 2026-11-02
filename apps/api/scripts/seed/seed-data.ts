import type { TicketPriority, TicketStatus, UserStatus } from "@docket/contracts";

/**
 * Sign-in accounts for local development. The password is published in the README, which is why
 * the seed refuses to run against anything but a local database.
 */
export const SEED_PASSWORD = "docket local password";

export interface SeedAccount {
  email: string;
  name: string;
  status: UserStatus;
  roles: string[];
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  { email: "admin@docket.test", name: "Ada Admin", status: "active", roles: ["admin"] },
  { email: "member@docket.test", name: "Mo Member", status: "active", roles: ["member"] },
  { email: "pending@docket.test", name: "Pat Pending", status: "pending", roles: ["member"] },
];

export interface SeedTicket {
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  /** How long ago the ticket was opened. */
  hoursAgo: number;
  /** Email of the seed account that opened it. */
  createdBy: string;
}

const ADMIN = "admin@docket.test";
const MEMBER = "member@docket.test";

export const SEED_TICKETS: SeedTicket[] = [
  {
    title: "Laptop will not wake from sleep",
    description:
      "Dell Latitude in finance. Black screen after closing the lid; only a hard restart works.",
    status: "open",
    priority: "high",
    hoursAgo: 2,
    createdBy: MEMBER,
  },
  {
    title: "Shared drive mapping lost after update",
    description:
      "The S: drive disappeared for three people in marketing after last night's Windows update.",
    status: "in_progress",
    priority: "high",
    hoursAgo: 5,
    createdBy: ADMIN,
  },
  {
    title: "New starter needs accounts on Monday",
    description: "Email, VPN and payroll access for Amina Otieno, starting in operations.",
    status: "open",
    priority: "medium",
    hoursAgo: 9,
    createdBy: MEMBER,
  },
  {
    title: "Meeting room screen shows no signal",
    description: "Room 3B. HDMI cable tested with two laptops, same result.",
    status: "closed",
    priority: "low",
    hoursAgo: 30,
    createdBy: ADMIN,
  },
  {
    title: "Password reset emails arrive late",
    description: "Users report a 20 minute delay on reset emails from the HR portal.",
    status: "in_progress",
    priority: "medium",
    hoursAgo: 41,
    createdBy: MEMBER,
  },
  {
    title: "Printer on floor 4 jams on duplex",
    description: null,
    status: "open",
    priority: "low",
    hoursAgo: 52,
    createdBy: MEMBER,
  },
  {
    title: "VPN disconnects every hour",
    description: "Remote staff in Mombasa lose the tunnel on the hour, every hour.",
    status: "in_progress",
    priority: "high",
    hoursAgo: 60,
    createdBy: ADMIN,
  },
  {
    title: "Request: second monitor for design team",
    description: "Two 27 inch monitors for the new design desks.",
    status: "open",
    priority: "low",
    hoursAgo: 75,
    createdBy: MEMBER,
  },
  {
    title: "Outlook keeps asking for credentials",
    description: "Started after the password change. Affects one mailbox only.",
    status: "closed",
    priority: "medium",
    hoursAgo: 90,
    createdBy: ADMIN,
  },
  {
    title: "Payroll export fails with a timeout",
    description: "Month-end export times out after two minutes. Smaller date ranges work.",
    status: "open",
    priority: "high",
    hoursAgo: 102,
    createdBy: MEMBER,
  },
  {
    title: "Teams calls drop audio after 10 minutes",
    description: null,
    status: "in_progress",
    priority: "medium",
    hoursAgo: 118,
    createdBy: ADMIN,
  },
  {
    title: "Access to the procurement folder",
    description: "Needs read access for the audit, until the end of the quarter.",
    status: "closed",
    priority: "low",
    hoursAgo: 130,
    createdBy: MEMBER,
  },
  {
    title: "Wi-Fi slow in the east wing",
    description: "Speed tests under 5 Mbps around the kitchen and meeting room 2.",
    status: "open",
    priority: "medium",
    hoursAgo: 150,
    createdBy: ADMIN,
  },
  {
    title: "Phishing email reported by reception",
    description:
      "Message claims to be from the bank, link goes to a lookalike domain. Forwarded as an attachment.",
    status: "closed",
    priority: "high",
    hoursAgo: 170,
    createdBy: MEMBER,
  },
  {
    title: "Keyboard missing keys",
    description: "The E and R keys came off. Spare keyboard requested.",
    status: "closed",
    priority: "low",
    hoursAgo: 190,
    createdBy: ADMIN,
  },
  {
    title: "CRM dashboard loads blank",
    description: "Sales dashboard shows the header only. Other dashboards work.",
    status: "open",
    priority: "medium",
    hoursAgo: 215,
    createdBy: MEMBER,
  },
  {
    title: "Install statistics software for analyst",
    description: "Licence already purchased, needs installing on the analyst laptop.",
    status: "in_progress",
    priority: "low",
    hoursAgo: 240,
    createdBy: ADMIN,
  },
  {
    title: "Backup job failed two nights in a row",
    description: "File server backup reports a locked file error at 02:00.",
    status: "open",
    priority: "high",
    hoursAgo: 260,
    createdBy: MEMBER,
  },
  {
    title: "Calendar shows wrong time zone",
    description: "Invites from the Nairobi office show an hour off for two users.",
    status: "closed",
    priority: "medium",
    hoursAgo: 290,
    createdBy: ADMIN,
  },
  {
    title: "Desk phone has no dial tone",
    description: null,
    status: "open",
    priority: "medium",
    hoursAgo: 320,
    createdBy: MEMBER,
  },
  {
    title: "Expense app crashes on receipt upload",
    description: "Android app closes when attaching a photo larger than a few megabytes.",
    status: "in_progress",
    priority: "medium",
    hoursAgo: 350,
    createdBy: ADMIN,
  },
  {
    title: "Remove access for leaver",
    description: "Brian Kamau left on Friday. Disable email, VPN and building pass.",
    status: "closed",
    priority: "high",
    hoursAgo: 380,
    createdBy: MEMBER,
  },
  {
    title: "Projector bulb flickering",
    description: "Training room projector flickers after 15 minutes of use.",
    status: "open",
    priority: "low",
    hoursAgo: 410,
    createdBy: ADMIN,
  },
  {
    title: "Two-factor codes rejected",
    description: "Authenticator codes are rejected for one user. Phone clock may be off.",
    status: "closed",
    priority: "medium",
    hoursAgo: 440,
    createdBy: MEMBER,
  },
  {
    title: "Request: shared mailbox for support",
    description: "support@ shared mailbox for the customer team, five members.",
    status: "open",
    priority: "low",
    hoursAgo: 480,
    createdBy: ADMIN,
  },
];
