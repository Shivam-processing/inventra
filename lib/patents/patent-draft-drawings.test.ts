import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefDescriptionOfDrawings, createPatentDraftFigures } from "./patent-draft-drawings";

describe("patent drawing metadata", () => {
  it("numbers one or several figures stably with neutral captions", () => {
    const figures = createPatentDraftFigures(["PROTOTYPE", "FRONT_VIEW", "SKETCH"]);
    assert.deepEqual(figures.map((figure) => figure.figureNumber), [1, 2, 3]);
    assert.match(briefDescriptionOfDrawings(figures), /^FIG\. 1[\s\S]*FIG\. 3/);
    assert.doesNotMatch(briefDescriptionOfDrawings(figures), /sensor|wiring|material|dimension|storage_path|signed/i);
  });
  it("emits no fake figure when no image metadata exists", () => {
    assert.deepEqual(createPatentDraftFigures([]), []);
    assert.equal(briefDescriptionOfDrawings([]), "");
  });
});
