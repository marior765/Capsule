export type { Tag } from "./model";
export {
  tagsMigration,
  capsuleTagsMigration,
  getAllTags,
  getTagById,
  getTagByName,
  insertTag,
  updateTag,
  deleteTag,
  getTagsByCapsule,
  getCapsuleIdsByTag,
  addTagToCapsule,
  removeTagFromCapsule,
  deleteCapsuleTagsByCapsule,
  deleteCapsuleTagsByTag,
} from "./db";
