import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INVENTION_DELETE_DEPENDENCIES,
  authorizeInventionDeletion,
  deletionConfirmationMatches,
  parseDeletionRequest,
  validInventionImageStoragePath,
} from "./deletion";

const inventionId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const invention = { id: inventionId, userId, title: "Timed medicine box" };

describe("invention deletion safeguards", () => {
  it("rejects unauthenticated deletion", () => {
    assert.deepEqual(authorizeInventionDeletion(null, invention), { allowed: false, reason: "UNAUTHENTICATED" });
  });

  it("rejects malformed invention identifiers", () => {
    assert.equal(parseDeletionRequest("not-a-uuid", "DELETE").success, false);
  });

  it("rejects deletion of another user's invention", () => {
    assert.deepEqual(authorizeInventionDeletion("another-user", invention), { allowed: false, reason: "NOT_OWNED" });
  });

  it("requires the exact title or DELETE confirmation", () => {
    assert.equal(deletionConfirmationMatches("Timed medicine box", invention.title), true);
    assert.equal(deletionConfirmationMatches("DELETE", invention.title), true);
    assert.equal(deletionConfirmationMatches("delete", invention.title), false);
  });

  it("tracks every related workflow table covered by cascading deletion", () => {
    assert.deepEqual(INVENTION_DELETE_DEPENDENCIES, ["invention_images", "patent_searches", "overlap_reports", "patent_drafts"]);
  });

  it("accepts only storage objects inside the owned invention prefix", () => {
    assert.equal(validInventionImageStoragePath(`${userId}/${inventionId}/image.webp`, userId, inventionId), true);
    assert.equal(validInventionImageStoragePath(`${userId}/33333333-3333-4333-8333-333333333333/image.webp`, userId, inventionId), false);
    assert.equal(validInventionImageStoragePath(`another-user/${inventionId}/image.webp`, userId, inventionId), false);
    assert.equal(validInventionImageStoragePath(`${userId}/${inventionId}/nested/image.webp`, userId, inventionId), false);
  });

  it("rejects a repeated request after the owned record is gone", () => {
    assert.deepEqual(authorizeInventionDeletion(userId, null), { allowed: false, reason: "NOT_OWNED" });
  });
});
