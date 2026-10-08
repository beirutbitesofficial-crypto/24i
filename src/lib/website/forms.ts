import { z } from "zod";
import { services } from "./site";

const serviceTitles = services.map((s) => s.title) as [string, ...string[]];

const base = {
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email.").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  service: z.enum([...serviceTitles, "Not sure yet"] as [string, ...string[]], { errorMap: () => ({ message: "Choose a service." }) }),
  // Honeypot: real visitors never see or fill this field.
  company_website: z.string().max(0).optional().or(z.literal("")),
};

export const contactSchema = z.object({
  ...base,
  message: z.string().trim().min(10, "Tell us a little more (10+ characters).").max(4000),
});

export const MEETING_SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"] as const;

export const bookingSchema = z.object({
  ...base,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
    .refine((d) => {
      const day = new Date(`${d}T12:00:00Z`);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return !Number.isNaN(day.getTime()) && day >= today && day.getUTCDay() !== 0;
    }, "Pick an upcoming day from Monday to Saturday."),
  time: z.enum(MEETING_SLOTS, { errorMap: () => ({ message: "Choose a time." }) }),
  format: z.enum(["Studio visit", "Video call"], { errorMap: () => ({ message: "Choose a format." }) }),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export const SERVICE_OPTIONS = [...serviceTitles, "Not sure yet"];
