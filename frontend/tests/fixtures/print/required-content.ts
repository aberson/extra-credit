import type {
  SentenceItemV1,
  WorksheetDocumentV1,
} from "../../../src/shared/worksheet/types.ts";

export interface RequiredPrintContent {
  readonly selector: string;
  readonly count: number;
  readonly texts?: readonly string[];
  readonly shape?: "closed" | "bottom-rule";
}

// Expected child-facing content is derived from the generated fixture, never
// collected from the screen DOM: deleting a node must not shrink this manifest.
export function requiredPrintContent(
  document: WorksheetDocumentV1,
  surface: "worksheet" | "answer",
): readonly RequiredPrintContent[] {
  const required: RequiredPrintContent[] = [];
  const text = (selector: string, ...texts: string[]) => {
    required.push({ selector, count: texts.length, texts });
  };
  const boxes = (selector: string, count: number, shape: RequiredPrintContent["shape"] = "closed") => {
    required.push({ selector, count, shape });
  };
  const sentenceInstruction = {
    "draw-and-tell": "Draw your picture, then tell a grown-up about it.",
    label: "",
    "copy-with-model": "",
    "sentence-frame": "Finish the sentence frame on the writing lines.",
    independent: "Draw your picture, then write about it on the lines.",
  };
  const titles = {
    "dry-math": "Dry Math practice",
    "find-the-wow": "Math — Two Whats and a Wow practice",
    "sentence-builder": "Sentence Builder practice",
    "count-compare-make": "Count, Compare & Make practice",
    "number-bonds": "Number Bonds practice",
  };
  const first = document.items[0];
  const instruction = first?.itemType === "sentence"
    ? sentenceInstruction[first.writingMode]
    : first?.itemType === "wow-group"
      ? first.mode === "quantity"
        ? "Circle the wow in each group: the one numeral-and-dot pair that matches."
        : "Circle the wow in each group: the one equation that is true."
      : document.worksheetType === "dry-math"
        ? "Practice page · solve each equation."
        : document.worksheetType === "number-bonds"
          ? "Write the missing number in each box."
          : "";
  const title = titles[document.worksheetType];
  text("header h2", surface === "answer"
    ? "Parent answer key"
    : `${document.request.displayName}’s ${title}`);
  text("header p:not([data-doodle-note])", ...(surface === "answer"
    ? ["Answers match the numbered problems on the worksheet."]
    : instruction === "" ? [] : [instruction]));
  required.push({ selector: "[data-item-id]", count: document.items.length });

  function sentenceContent(item: SentenceItemV1, selector: string) {
    text(`${selector} [data-sentence-prompt]`, item.prompt);
    text(`${selector} [data-bank-word]`, ...(item.wordBank ?? []));
    if (item.wordBank !== undefined) {
      text(`${selector} [data-word-bank] h3`, item.writingMode === "independent"
        ? "Idea words"
        : "Word bank");
    }
    text(`${selector} [data-model-sentence]`, ...(
      item.modelSentence === undefined ? [] : [item.modelSentence]
    ));
    text(`${selector} [data-sentence-frame]`, ...(
      item.sentenceFrame === undefined ? [] : [item.sentenceFrame]
    ));
    const response = item.requiredResponse;
    boxes(`${selector} [data-drawing-box]`, response.drawing ? 1 : 0);
    if (response.drawing) {
      text(`${selector} [data-drawing-area] > p`, "Draw your picture here.");
    }
    text(`${selector} [data-dictation-note]`, ...(
      response.dictation ? ["This part is for talking, not writing."] : []
    ));
    // These fixtures request long. Bank modes shorten to standard for large
    // print; copy-with-model always normalizes to standard (three lines).
    const large = document.request.options.printScale === "large";
    const lines = {
      label: response.labels ? (large ? 4 : 5) : 0,
      copy: response.copying ? 3 : 0,
      write: response.writing
        ? (item.writingMode === "independent" ? (large ? 5 : 6) : (large ? 3 : 4))
        : 0,
    };
    const captions = {
      label: "Write your labels here.",
      write: item.writingMode === "independent"
        ? "Write your sentences here."
        : "Write your sentence here.",
    };
    for (const kind of ["label", "copy", "write"] as const) {
      boxes(`${selector} [data-response-line="${kind}"]`, lines[kind], "bottom-rule");
      if (kind === "copy") {
        text(`${selector} [data-response-lines="copy"] > p`);
      } else if (lines[kind] > 0) {
        text(`${selector} [data-response-lines="${kind}"] > p`, captions[kind]);
      }
    }
  }

  for (const [index, item] of document.items.entries()) {
    const selector = `[data-item-id="${item.id}"]`;
    required.push({ selector, count: 1 });
    if (surface === "answer") {
      if (item.answerability !== "objective") {
        throw new Error("An open response cannot have an answer key.");
      }
      text(`${selector} [data-problem-number]`, `${index + 1}.`);
      const answer = item.answer;
      const answerText = answer.kind === "comparison"
        ? { less: "fewer than", equal: "the same as", greater: "more than" }[answer.value]
        : answer.kind === "choice"
          ? `Choice ${answer.value + 1}`
          : String(answer.value);
      text(`${selector} [data-answer-value]`, answerText);
      if (item.itemType === "dry-math") {
        text(`${selector} [data-source-expression]`,
          `${item.leftOperand} ${item.renderedSymbol} ${item.rightOperand}`);
      }
      if (item.itemType === "number-bond") {
        // The problem as printed, its blank written as ?.
        const left = item.missing === "left" ? "?" : String(item.leftOperand);
        const right = item.missing === "right" ? "?" : String(item.rightOperand);
        text(`${selector} [data-source-expression]`,
          `${left} ${item.renderedSymbol} ${right} = ${item.result}`);
      }
      continue;
    }
    switch (item.itemType) {
      case "dry-math":
        text(`${selector} > span`,
          `${item.leftOperand} ${item.renderedSymbol} ${item.rightOperand} = ____`);
        // The sign prints in its own element, so its own visibility is checked.
        text(`${selector} [data-operator]`, item.renderedSymbol);
        break;
      case "number-bond": {
        // The blank is one drawn, empty, closed box; the other numbers print.
        const left = item.missing === "left" ? "" : String(item.leftOperand);
        const right = item.missing === "right" ? "" : String(item.rightOperand);
        text(`${selector} > span`, `${left} ${item.renderedSymbol} ${right} = ${item.result}`);
        text(`${selector} [data-operator]`, item.renderedSymbol);
        boxes(`${selector} [data-missing-box]`, 1);
        break;
      }
      case "sentence":
        sentenceContent(item, selector);
        break;
      case "wow-group":
        text(`${selector} > strong`, `Group ${index + 1}`);
        boxes(`${selector} [data-circle-target]`, item.choices.length);
        for (const [choiceIndex, choice] of item.choices.entries()) {
          const choiceSelector = `${selector} [data-wow-choice]:nth-child(${choiceIndex + 1})`;
          text(`${choiceSelector} [data-choice-number]`, `${choiceIndex + 1}.`);
          if (choice.kind === "quantity") {
            text(`${choiceSelector} [data-visible-numeral]`, String(choice.numeral));
            text(`${choiceSelector} [data-quantity-mark]`,
              ...Array<string>(choice.quantity).fill("●"));
            text(`${choiceSelector} > span:last-child > span[aria-hidden]`, "↔");
            required.push({ selector: `${choiceSelector} [role="img"]`, count: 1 });
          } else {
            text(`${choiceSelector} [data-visible-equation]`,
              `${choice.leftOperand} ${choice.renderedSymbol} ${choice.rightOperand}` +
              ` = ${choice.displayedResult}`);
          }
        }
        break;
      case "count-compare": {
        text(`${selector} > [data-problem-number]`, `${index + 1}.`);
        if (item.activity !== "compare") {
          text(`${selector} [data-visible-numeral]`, String(item.target));
        }
        switch (item.activity) {
          case "match":
            text(`${selector} [data-item-prompt]`,
              `Circle the group that shows ${item.target}.`);
            boxes(`${selector} [data-circle-target]`, item.choices.length);
            for (const [choiceIndex, quantity] of item.choices.entries()) {
              const choiceSelector = `${selector} [data-match-choice="${choiceIndex + 1}"]`;
              text(`${choiceSelector} > strong`, `${choiceIndex + 1}.`);
              text(`${choiceSelector} [data-instructional-mark]`,
                ...Array<string>(quantity).fill("■"));
            }
            break;
          case "compare":
            text(`${selector} [data-item-prompt]`,
              "Count both groups. Circle the words that finish the sentence.");
            text(`${selector} [data-compare-group] > p`, "First group", "Second group");
            text(`${selector} > p:not([data-item-prompt])`,
              "The first group has", "the second group.");
            text(`${selector} [data-relation-word]`,
              "fewer than", "the same as", "more than");
            text(`${selector} [data-compare-group="first"] [data-instructional-mark]`,
              ...Array<string>(item.leftQuantity).fill("●"));
            text(`${selector} [data-compare-group="second"] [data-instructional-mark]`,
              ...Array<string>(item.rightQuantity).fill("▲"));
            break;
          case "complete":
            text(`${selector} [data-item-prompt]`,
              `This group needs ${item.target} in all. ` +
              "Draw the missing marks in the empty boxes.");
            text(`${selector} [data-instructional-mark="filled"]`,
              ...Array<string>(item.partial).fill("●"));
            boxes(`${selector} [data-instructional-mark]`,
              Math.ceil(item.target / 10) * 10);
            boxes(`${selector} [data-instructional-visual="ten-frame"]`, 1);
            break;
          case "draw":
            text(`${selector} [data-item-prompt]`,
              `Draw ${item.target} ${item.target === 1 ? "mark" : "marks"} in the boxes.`);
            text(`${selector} [data-instructional-guide] > p`, "Draw your marks here.");
            boxes(`${selector} [data-instructional-guide-cells]`, 1);
            boxes(`${selector} [data-instructional-guide-cell]`,
              Math.ceil(item.target / 10) * 10);
            break;
        }
        break;
      }
    }
  }
  return required;
}
