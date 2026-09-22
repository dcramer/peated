import { z } from "zod";
import {
  REPORT_OBJECT_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
} from "../db/schema/reports";

export const ReportObjectTypeEnum = z.enum(REPORT_OBJECT_TYPES);
export const ReportReasonEnum = z.enum(REPORT_REASONS);
export const ReportStatusEnum = z.enum(REPORT_STATUSES);

export const REPORT_REASON_LABELS = {
  spam: "Spam or advertising",
  harassment: "Harassment or bullying",
  hate: "Hateful content",
  sexual_content: "Sexual content",
  violence: "Violence or threats",
  other: "Something else",
} satisfies Record<z.infer<typeof ReportReasonEnum>, string>;

export const ReportInputSchema = z
  .object({
    objectType: ReportObjectTypeEnum.describe(
      "What is being reported: a tasting, a member review, a comment, or a member.",
    ),
    objectId: z.coerce
      .number()
      .int()
      .positive()
      .describe(
        "ID of the reported tasting, member review, comment, or member.",
      ),
    reason: ReportReasonEnum.describe("Why the content is being reported."),
    comment: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .describe("Optional details for moderators."),
  })
  .strict();

export const ReportSchema = z.object({
  id: z.number().readonly(),
  objectType: ReportObjectTypeEnum,
  objectId: z.number(),
  reason: ReportReasonEnum,
  comment: z.string().nullable(),
  status: ReportStatusEnum,
  createdAt: z.string().datetime(),
});

const ReportMemberSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  suspended: z.boolean(),
});

export const AdminReportSchema = z
  .object({
    id: z.number().int().positive(),
    objectType: ReportObjectTypeEnum,
    objectId: z.number().int().positive(),
    reason: ReportReasonEnum,
    comment: z.string().nullable(),
    status: ReportStatusEnum,
    createdAt: z.string().datetime(),
    createdBy: ReportMemberSchema,
    reportedUser: ReportMemberSchema,
    /** Where the reported content lives; null when it no longer exists. */
    contentUrl: z.string().nullable(),
    /** A short preview of the reported content; null when it no longer exists. */
    contentPreview: z.string().nullable(),
    /** Open reports from other members about the same target. */
    openReportCount: z.number().int().min(0),
    closedAt: z.string().datetime().nullable(),
    closedBy: z.object({ id: z.number(), username: z.string() }).nullable(),
    closeNote: z.string().nullable(),
  })
  .strict();

export const AdminReportListInputSchema = z
  .object({
    status: ReportStatusEnum.default("open").describe(
      "Filter by report status.",
    ),
    cursor: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  })
  .strict()
  .default({ status: "open", cursor: 1, limit: 50 });

export const AdminReportCloseInputSchema = z
  .object({
    report: z.coerce.number().int().positive(),
    status: z
      .enum(["resolved", "dismissed"])
      .describe(
        "`resolved` when action was taken; `dismissed` when no action was needed.",
      ),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe("What the moderator did or why the report was dismissed."),
  })
  .strict();

export type ReportInput = z.infer<typeof ReportInputSchema>;
export type AdminReport = z.infer<typeof AdminReportSchema>;
