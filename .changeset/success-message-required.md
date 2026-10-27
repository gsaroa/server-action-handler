---
"server-action-handler": major
---

`ActionSuccess.message` is now `string`, not `string | undefined`. `actionHandler` always set it (your `{ data, message }` shorthand, or its own default), so results are unchanged; only the type is narrower. Code that builds an `ActionSuccess` by hand (mocks, tests) must now include `message`.
