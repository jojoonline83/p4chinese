# p4chinese

- **小宝学华文** (main app): https://jojoonline83.github.io/p4chinese/
- **假期华文冲刺营** (holiday revision camp): https://jojoonline83.github.io/p4chinese/holiday/

## 假期华文冲刺营 (`public/holiday/`)

A plain HTML/JS page for daily Chinese revision during the Singapore school holidays (P4 → P5).
Vite copies `public/holiday/` to `dist/holiday/` as-is, so the page has no build step.

- **Daily check-in and points**: +10 per day, streak bonuses, ranks, badges and a holiday calendar.
- **Three daily tasks**: a vocab warm-up, one WA section and one composition drill (they rotate daily).
- **Vocab review, P1–P4**: pinyin, words from pinyin, word choice and measure words. "Smart mix" gives more questions from the weakest level.
- **WA formats**: 语文应用 (incl. 重组句子), 短文填空, 完成对话, 阅读理解 (MCQ + open-ended with model answers), and a mock WA.
- **Composition workshop (五步写作法)**: plan from the pictures → outline → choose good phrases → write with a live checker → self-assess with a rubric. Also short drills (扩句, 心情描写, 好开头), an annotated model essay and a saved essay book with parent comments.
- **Oral**: read-aloud with text-to-speech, a conversation answer formula, and self-recording.
- **P5 preview**: 关联词, 成语, 修辞.
- **Mistake book and parent report**: wrong answers are saved for retry. The report shows accuracy by level and question type.

Progress is stored in the browser's localStorage. Use export/import on the 「我的」 page to move it to another device.

Content files: `data.js` (question bank) and `app.js` (logic).
