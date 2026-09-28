# Archived scripts

These one-off scripts mutate or fabricate cemetery data and were moved out of
`scripts/` to reduce the risk of running them by accident. They are retained for
reference only.

| Script | What it does | Guard |
| --- | --- | --- |
| `seed-apartment-rows.js` | **Destructive.** Deletes all `ROW-0*` plots/graves/details for the CMP location and seeds 15 concrete rows plus **fabricated** burial records that are auto-marked verified. | `CONFIRM_DESTRUCTIVE_SCRIPT=yes` |
| `revise-all-plots.js` | **Destructive.** Bulk-rewrites the GPS coordinates of every plot in a hardcoded set of section ids. | `CONFIRM_DESTRUCTIVE_SCRIPT=yes` |

Both scripts refuse to run without the explicit confirmation environment
variable above. Even with it, **never run these against a real cemetery
database** — they contain invented personal data and hardcoded section ids.

Related guards elsewhere:

- `scripts/reset-passwords.js` (not archived) requires
  `CONFIRM_RESET_ALL_PASSWORDS=yes` because it resets every account password to
  a known value and clears rate-limit buckets.
