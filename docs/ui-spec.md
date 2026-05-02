# UI Spec

## Design Direction

The MVP UI should feel quiet, lightweight, and easy to use during a real moment with a cat.

The app should not feel like a dense medical tool or a content-heavy dashboard.

## Visual Rules

- Gray-based palette.
- Maximum one accent color.
- Avoid using color as the main meaning system.
- No shadows or minimal shadows only.
- Flat rounded buttons.
- Wide spacing.
- Low information density.
- Avoid decorative clutter.

## Home Screen

Home is an input screen.

It should show only:

- App-level context if needed.
- Category: `いまの様子`.
- Category: `気になること`.
- The allowed options under each category.

Home must not show:

- `記録する`
- `今やること`
- Action recommendations
- Diagnosis result text
- Educational content blocks

## Home Options

### いまの様子

- ねてる
- 遊んでる
- グルーミング
- ご飯たべた
- トイレした
- ゴロゴロしてる

### 気になること

- 鳴いてる
- ついてくる
- 落ち着かない
- 元気ない
- ケンカしてる
- よくわからない

## Diagnosis Flow

The first diagnosis flow starts from `鳴いてる`.

The flow should:

- Ask only for context needed by the scoring logic.
- Keep choices simple.
- Avoid making the user feel they must answer perfectly.
- Let the deterministic logic decide the result.

## Result Screen

The result screen is where action suggestions may appear.

It should:

- Show one or two possible cause categories.
- Avoid presenting a result as certain.
- Show calm suggested next actions.
- Show feedback controls.

## Feedback

Feedback should be lightweight.

Initial feedback can capture whether the result was:

- Helpful
- Not helpful
- Unsure

Exact labels can be refined during UI implementation and recorded in `docs/decisions.md` if changed.

## Responsiveness

The MVP should be designed mobile-first because the expected usage context is quick input while observing a cat.

The web implementation should also be comfortable on desktop.

## Home Carryover Guess

The Home screen may show a small carryover guess above the input sections.

This display is not a new diagnosis and should not be treated as the app's final answer. It is a lightweight continuation from the previous onboarding or diagnosis experience.

The carryover guess is a recent hypothesis, not the current answer.

### When To Show

- Show immediately after onboarding completion.
- Later, consider showing after a completed diagnosis if the result is recent and has enough context.
- Treat it as a handoff from onboarding completion or the most recent diagnosis.
- Add an expiration rule before production. A reasonable MVP candidate is to expire the carryover guess after a short window, such as the same session or a few hours.

### When To Hide

- Hide when the user starts a new concern flow, such as tapping `鳴いてる`.
- Consider hiding when the user records a new current state that may change context, such as `ご飯たべた` or `遊んでる`.
- Hide when the user makes any new Home input.
- Do not add a close button yet unless the display starts feeling intrusive.
- Avoid permanent display. The carryover guess should feel temporary.

### Copy

Current copy:

```text
さっきの様子から
遊びたい可能性があります
```

This is natural for Home as long as it reads as a soft carryover from the previous step. It should not sound like a definitive live diagnosis.

Preferred copy qualities:

- Soft
- Short
- Non-definitive
- Clearly about possibility, not certainty

### Relationship To Input UI

- The carryover guess should support the input flow, not replace it.
- Home remains the place where the user tells the app what is happening now.
- The guess should stay visually quiet and should not compete with the two Home input sections.
- The input buttons remain the primary action on Home.
