# UAT round 1: profile clarity and arithmetic presets

The operator requested these changes after reviewing the completed initial build.
This revision extends the original plan's numeric contract for **Dry Math only**:
symbolic operands and answers can reach 100; quantity pictures, ten-frames and
Two Whats and a Wow retain their 20 ceiling. Existing saved profiles remain valid.

Changes for the next attended review:

- Four additional math presets: addition within 20, subtraction within 20,
  and addition/subtraction within 50 or 100. These still exclude carrying,
  borrowing and negative answers. Higher limits affect real Dry Math generation,
  its stretch preview, available problem pool and answer validation.
- Writing mode explains that it controls Sentence Builder: drawing/dictation,
  labeling, model copying, sentence frames or independent writing.
- Normal presets include their sentence vocabulary setting. Only custom or
  ambiguous presets need a separate vocabulary choice.
- Inactive future permission switches are removed. Existing stored values are
  retained when editing other custom capabilities; generators still ignore them.
- Model-copying worksheets retain one generated instruction, the model sentence
  and writing lines, without the repeated header instruction or response caption.

Follow-up feedback remains recorded locally: remove age and its generation gate
with compatible profile handling; further operations/representations; and
interest-driven instructional icons for Wow and Count/Compare. Age currently
only supplies initial suggestions and the 4–8 eligibility gate, not problem
generation. This revision has not removed it.

For the next screen review, edit Avery, choose **Addition and subtraction within
100**, save, then generate Dry Math at Practice. Try Standard and Large print,
and compare its separate key. Switch a profile to **copy with model** and generate
Sentence Builder to inspect the shorter instructions. Use fictional profiles.

The automated expansion test saves all four new presets through the compiled UI,
checks the saved capabilities and actual generated arithmetic, and verifies one
worksheet page plus one matching key page for both paper sizes and scales.
This is not physical-printer or family-pilot acceptance.
