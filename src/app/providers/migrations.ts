import type { Migration } from "@/shared/db";
import { modelsMigration } from "@/entities/model";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
} from "@/entities/conversation";
import { messagesMigration, messagesParentMigration } from "@/entities/message";
import { personasMigration } from "@/entities/persona";
import { auditMigration } from "@/entities/audit";
import { capsuleTypesMigration } from "@/entities/capsule-type";
import { capsuleFieldsMigration } from "@/entities/field";
import { capsulesMigration, capsuleValuesMigration } from "@/entities/capsule";
import { capsuleTagsMigration, tagsMigration } from "@/entities/tag";
import { capsuleLinksFieldIdMigration, linksMigration } from "@/entities/link";
import { attachmentsMigration } from "@/entities/attachment";

/**
 * Every migration the app runs at boot, in one place. Deliberately kept in
 * its own module with no `react-native-unistyles`/`LlmProvider`/
 * `SttProvider` imports — `./index.tsx` pulls in `react-native-unistyles`,
 * which requires a real native NitroModules binary and crashes immediately
 * under jest (`TurboModuleRegistry.getEnforcing(...): 'NitroModules' could
 * not be found`). That made this array untestable through `./index.tsx`,
 * and an entire domain's migrations (`capsuleTypesMigration`,
 * `capsuleFieldsMigration`, `capsulesMigration`, `capsuleValuesMigration`)
 * sat unregistered here for several beats without a single test catching
 * it — every capsule feature test passed anyway because each one calls
 * `runMigrations` with its own hand-picked list, never this one. A real
 * app boot would have left every capsule table missing entirely.
 */
export const migrations: Migration[] = [
  modelsMigration,
  conversationsMigration,
  messagesMigration,
  personasMigration,
  conversationsPersonaMigration,
  messagesParentMigration,
  conversationsLeafMigration,
  auditMigration,
  capsuleTypesMigration,
  capsuleFieldsMigration,
  capsulesMigration,
  capsuleValuesMigration,
  tagsMigration,
  capsuleTagsMigration,
  linksMigration,
  capsuleLinksFieldIdMigration,
  attachmentsMigration,
];
