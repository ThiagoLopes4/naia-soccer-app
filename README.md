# Road to Orange Beach · Name TBD

A player-built, English-language guide to the 2026 NAIA Men's Soccer National Championship. The Touchline Atlas design pairs a printed-programme bracket with the practical details a player, family member or supporter needs on matchday. The dashboard opens on the complete draw.

## Local use

From the project root, run:

```sh
python3 -m http.server 8000 --directory site
```

Open http://localhost:8000. The site uses plain HTML, CSS, JavaScript and one JSON file. All fonts, artwork and team crests are bundled locally.

## Explore

- **Dashboard** opens on all 40 teams, with both halves feeding a central final. Tap any of the 39 games for details, use Enlarge for a closer look, or follow a matchup into its branch. Validated results update the winners, scores and completed-game count.
- **Bracket** opens the detailed branch explorer. Use **Find my team** to search all 40 schools, see the latest confirmed matchup and follow its path. Team links such as #bracket/team/lsu-alexandria survive a refresh.
- **Pods** groups the 24 opening games by their 16 campus hosts.
- **Round by Round** lists all 39 fixtures across six rounds.
- **All Teams** searches the 40 schools by name or conference. Select a school to see its opening match.
- Select a matchup for kickoff in venue time and Central time, the venue and an external stream link. Each game has its own stream URL field. The source package supplied the Network directory, so those links initially open the directory. Replace a game's URL with its verified broadcast link when available.

## Draw and source notes

The team names, 18 conferences, games, venues and opening kickoffs come from the supplied bracket-2026.md. The updated 10-team-logos-catalog.docx supplies 40 compact marks for the draw, games and search. Fourteen teams also have a separate wordmarkFile for the All Teams directory. The other 26 use the same PNG in both contexts. All crests load eagerly. A failed image displays its monogram. The two white-text marks have a dark backing.

On November 18 the official draw confirmed the field's matchups and seeded positions, including William Carey at 5, Oklahoma Wesleyan at 9 and Grand View at 13. It also established the quarterfinal paths. The opening kickoffs are host-reported in the supplied package. Known final-site dates are preserved. Other kickoff times and the quarterfinal day assignments remain TBA. The submitted package contains no championship finals yet.

- [Official 2026 championship bracket](https://www.naia.org/wp-content/uploads/2026/11/2026_Bracket_MSOC-1.pdf)
- [Official championship hub and schedules](https://www.naia.org/sports/mens-soccer/championships/)
- [Official field announcement](https://www.naia.org/news/mens-soccer/mens-soccer-championships/2026-naia-mens-soccer-national-championship-field-unveiled/)

## GitHub Pages and score updates

Use a repository with a main branch. Select **Settings → Pages → Source → GitHub Actions** and push this project. The workflow publishes only site/. The repository must permit the workflow to commit validated JSON updates. Screenshots are in docs/design/.

The schedule requests a run every five minutes on tournament dates. The page checks the JSON every 30 seconds and retains its current draw on a failed request. Five and a half minutes is the nominal polling interval. GitHub queueing, deployment and source delays can extend it.

During matchdays a separate Watch matchday scores workflow checks pending fixtures every five minutes within a running session. It dispatches the normal publisher when a validated result becomes available. Each session ends after four hours, at the end of the local day, or when no fixtures remain open. Hourly scheduled starts cover the match windows. GitHub can delay the initial start of either workflow. You can start the watcher manually from Actions. The national feed is revalidated in five-minute cache intervals.

The updater reads the public [NAIA national scoreboard](https://www.naia.org/sports/mens-soccer/championships/). It fetches men's soccer events by tournament date, including all pages, and rechecks earlier rounds for late results. The November 19 GitHub Actions access test found eight first-round listings and fifteen second-round listings. Missing fixtures retain their last confirmed state. The scoreboard supplies results only. Kickoffs and venues remain separately verified. An explicitly configured SCORE_FEED_URL selects the legacy PrestoSports RSS adapter instead.

Auto-publication requires an explicit final status, recognized participants, the expected date, a plausible result and an unambiguous scoring order. Only approved predecessors advance. A changed final, unresolved matchup, shootout or unfamiliar final stays in the workflow's score-review artifact. Source outages leave the deployed JSON intact. A retry with identical data preserves its timestamp. GitHub rejects concurrent non-fast-forward writes instead of overwriting manual edits.

**Manual entry.** Find the game ID and slot order in site/data/bracket-2026.json. Run the following command with the verified numbers substituted, then commit the JSON:

```sh
python3 scripts/scores.py --manual GAME_ID --score FIRST_GOALS SECOND_GOALS
```

For a shootout add `--penalties FIRST_KICKS SECOND_KICKS` alongside the tied match score. For an overtime win add `--overtime`. Each result receives a last-updated time. The UI shows game goals and the shootout decision separately.

Final-site games accept a verified gameTime string and a scorers array containing name and minute. These fields are maintained from match reports. No live-minute service is promised. Automatic writes end after December 7 in Central time. The final bracket, champion and entered scorers remain in the static archive. A late official correction can still be entered manually.

## Analytics

Set the repository variable GOATCOUNTER_CODE to the owner's GoatCounter site code to enable cookieless visitor counts and page views at deployment. Navigation counts use separate dashboard, bracket, pods, rounds and teams paths. The local site makes no analytics request. No account credentials are included.

## Design screenshots

[Desktop bracket](docs/design/desktop-bracket.png) · [Mobile bracket](docs/design/mobile-bracket.png) · [Match details](docs/design/match-details.png) · [Mobile schedule](docs/design/mobile-schedule.png)
