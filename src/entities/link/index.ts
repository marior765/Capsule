export type { CapsuleLink } from "./model";
export {
  linksMigration,
  capsuleLinksFieldIdMigration,
  getLinkById,
  getLinksFrom,
  getLinksFromByField,
  getLinksTo,
  insertLink,
  deleteLink,
  deleteLinksByCapsule,
} from "./db";
