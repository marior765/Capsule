export type { Attachment } from "./model";
export { ATTACHMENTS_DIRECTORY } from "./model";
export {
  attachmentsMigration,
  getAttachmentById,
  getAttachmentsByCapsule,
  getAttachmentsByCapsuleField,
  insertAttachment,
  deleteAttachment,
  deleteAttachmentsByCapsule,
} from "./db";
