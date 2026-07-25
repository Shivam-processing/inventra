import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareConceptGroups } from "./concept-matching";

describe("deterministic overlap concept matching", () => {
  it("does not match offline operation from operation alone", () => assert.equal(compareConceptGroups("Offline operation", "Local operation", "The operation controls a device.").matchType, "NOT_FOUND"));
  it("does not classify scheduled alone as partial scheduled unlocking", () => assert.notEqual(compareConceptGroups("Scheduled compartment unlocking", "Scheduled dispenser", "A scheduled medicine event is described.").matchType, "PARTIAL"));
  it("does not classify medicine compartments without locking as partial", () => assert.notEqual(compareConceptGroups("Independently lockable medicine compartments", "Medicine compartments", "A container has several medicine compartments for doses.").matchType, "PARTIAL"));
  it("does not classify reminder alone as audible reminder overlap", () => assert.notEqual(compareConceptGroups("Audible reminders", "Reminder unit", "A reminder is issued at a selected time.").matchType, "PARTIAL"));
  it("matches alarm evidence plus reminder context", () => assert.equal(compareConceptGroups("Audible reminders", "Alarm unit", "An audible alarm provides a medication reminder at dose time.").matchType, "FULL"));
  it("matches LED evidence plus reminder context", () => assert.equal(compareConceptGroups("Visual reminders", "LED reminder", "An LED is activated at a reminder time as a visual indicator.").matchType, "FULL"));
  it("requires explicit offline evidence", () => assert.equal(compareConceptGroups("Offline operation", "Local medication organiser", "The organiser works without internet connectivity or cloud dependency.").matchType, "FULL"));
  it("marks missing abstracts uncertain", () => assert.equal(compareConceptGroups("Audible reminders", "Audible reminder alarm", null).matchType, "UNCERTAIN"));
});
