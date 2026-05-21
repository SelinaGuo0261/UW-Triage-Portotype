Your previous segmentation JSON was invalid: concatenating all `segments[].text` in order does **not** equal SOURCE_TEXT (wrong length, missing characters, or altered text).

Return **ONLY** strict JSON: {"segments":[{"text":"..."}, ...]}

Requirements:
- Concatenating all `text` fields in order must match SOURCE_TEXT **exactly** (identical string).
- Same rules as the initial segmentation task: ordered partition, 1–96 segments, no extra keys inside each segment object besides `text`.

SOURCE_TEXT length: {{SOURCE_LENGTH}}

SOURCE_TEXT:
{{SOURCE_TEXT}}

Wrong previous JSON (may be truncated if very long; still fix the whole document mentally):
{{BAD_SEGMENTS_JSON}}
