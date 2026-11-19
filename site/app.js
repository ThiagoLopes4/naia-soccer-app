"use strict";
const $ = (selector) => document.querySelector(selector);
const content = $("#content"),
  dialog = $("#detail");
const titles = {
  dashboard: "Tournament dashboard",
  bracket: "Championship bracket",
  pods: "Campus pods",
  rounds: "Round by round",
  teams: "All teams",
};
const rounds = [
  "",
  "First round",
  "Second round",
  "Round of 16",
  "Quarterfinals",
  "Semifinals",
  "Final",
];
const dates = [
  "",
  "Thu, Nov 19",
  "Sat, Nov 21",
  "Nov 30 – Dec 1",
  "Dec 2–3 · Day TBA",
  "Sat, Dec 5",
  "Mon, Dec 7",
];
const order = [1, 8, 4, 5, 2, 7, 3, 6];
let data,
  rawData,
  enlarged = false,
  branch = 7,
  finals = false,
  round = 1,
  search = "",
  pod = 0,
  chosenGame = "";
const esc = (value) =>
  String(value ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const iconPaths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  bracket: "M3 4h5v6H3m5-3h5v10h-5m5-5h7M3 14h5v6H3",
  pods: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  rounds: "M4 6h16M4 12h16M4 18h16",
  teams:
    "M3 20v-2a6 6 0 0 1 12 0v2M13 5a4 4 0 0 1 3 7m2 3a5 5 0 0 1 3 5M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 6v6l4 2",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  cup: "M7 4h10v6a5 5 0 0 1-10 0zM7 6H3v2a4 4 0 0 0 5 4m9-6h4v2a4 4 0 0 1-5 4m-4 3v4m-4 1h8",
};
function icon(k) {
  return (
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="' +
    iconPaths[k] +
    '"/></svg>'
  );
}
document
  .querySelectorAll("nav a")
  .forEach((a) => a.insertAdjacentHTML("afterbegin", icon(a.hash.slice(1))));
function route() {
  const [page] = location.hash.slice(1).split("/");
  return Object.hasOwn(titles, page) ? page : "dashboard";
}
function resolved(slot) {
  if (data.teams[slot]) return slot;
  const g = data.games[slot];
  if (!g?.score) return null;
  const dec = g.penalties || g.score;
  if (dec[0] === dec[1]) return null;
  return resolved(g.slots[dec[0] > dec[1] ? 0 : 1]);
}
function label(slot, depth = 0) {
  const id = resolved(slot);
  if (id) return data.teams[id].name;
  const g = data.games[slot];
  if (depth > 0 && g.round >= 3) return rounds[g.round] + " " + slot;
  return (
    "Winner of " +
    g.slots
      .map((x) => {
        const name = label(x, depth + 1);
        return name.startsWith("Winner of") ? "(" + name + ")" : name;
      })
      .join(" × ")
  );
}
function crest(t, format = "compact") {
  const wordmark = format === "wordmark" && t.wordmarkFile;
  const file = wordmark || t.file;
  const dark = ["stanton", "wvu-tech"].includes(t.id) ? " dark" : "";
  return (
    '<span class="crest' +
    (wordmark ? " wordmark" : "") +
    dark +
    '"><img loading="eager" alt="" src="' +
    esc(file) +
    '" data-monogram="' +
    esc(
      t.name
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join(""),
    ) +
    '"></span>'
  );
}
document.addEventListener(
  "error",
  (e) => {
    if (e.target.matches?.("img[data-monogram]"))
      e.target.parentNode.textContent = e.target.dataset.monogram;
  },
  true,
);
function teamRow(slot, g, index) {
  const id = resolved(slot),
    t = data.teams[id],
    win = g.score && resolved(g.id) === id;
  return (
    '<div class="teamrow ' +
    (win ? "win " : "") +
    (t ? "" : "pending") +
    '">' +
    (t ? crest(t) : '<span class="blank">' + icon("bracket") + "</span>") +
    '<span class="teamname">' +
    (t?.seed ? "<sup>#" + t.seed + "</sup> " : "") +
    esc(t ? t.name : label(slot)) +
    "</span>" +
    (g.score ? '<strong class="points">' + g.score[index] + "</strong>" : "") +
    "</div>"
  );
}
function timePair(g) {
  if (!g.start) return "<b>Time TBA</b> <small>· CT</small>";
  const stamp = new Date(g.start),
    zone = data.sites[g.site].zone;
  const time = (z) =>
    stamp.toLocaleTimeString("en-US", {
      timeZone: z,
      hour: "numeric",
      minute: "2-digit",
    });
  const abbr = {
    "America/New_York": "ET",
    "America/Denver": "MT",
    "America/Chicago": "CT",
  }[zone];
  return (
    "<b>" +
    time(zone) +
    " " +
    abbr +
    "</b> <small>/ " +
    time("America/Chicago") +
    " CT</small>"
  );
}
function dateLabel(g) {
  return g.date
    ? new Date(g.date + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : dates[g.round];
}
function resultNote(g) {
  if (g.penalties)
    return (
      '<span class="badge">' +
      esc(data.teams[resolved(g.id)]?.name) +
      " won on penalties, " +
      g.penalties.join("–") +
      "</span>"
    );
  return g.overtime ? '<span class="badge">After overtime</span>' : "";
}
function card(g) {
  return (
    '<button class="game ' +
    (g.round > 2 ? "later " : "") +
    (g.score ? "completed" : "") +
    '" data-game="' +
    g.id +
    '"><span class="cardtop">' +
    icon("pods") +
    esc(data.sites[g.site].city) +
    '<span class="open">' +
    icon("arrow") +
    "</span></span>" +
    g.slots.map((s, i) => teamRow(s, g, i)).join("") +
    resultNote(g) +
    '<span class="cardfoot">' +
    icon(g.score ? "bracket" : "clock") +
    (g.score ? "Final" : timePair(g)) +
    "</span></button>"
  );
}
function mini() {
  return (
    '<div class="mini" aria-label="Draw branches">' +
    order
      .map(
        (n) =>
          '<button title="Show seeds ' +
          n +
          " and " +
          (17 - n) +
          '" aria-label="Show seeds ' +
          n +
          " and " +
          (17 - n) +
          '" aria-pressed="' +
          (!finals && n === branch) +
          '" data-branch="' +
          n +
          '"><i></i></button>',
      )
      .join("") +
    "</div>"
  );
}
// The two halves descend from the final's actual feeder games. Each campus pod
// occupies one of eight rows; later games sit midway between their feeders.
function championshipDraw() {
  const games = data.games;
  const final = games.C;
  const finalsCount = Object.values(games).filter((g) => g.score).length;
  const nodes = [];
  const paths = [];
  const compact = !enlarged && matchMedia("(max-width: 760px)").matches;
  const centers = compact
    ? { 1: 14, 2: 21.2, 3: 36.8, 4: 40.9, 5: 44.5, 6: 50 }
    : { 1: 7.1, 2: 22, 3: 33.3, 4: 39.3, 5: 44.1, 6: 50 };
  const widths = compact
    ? { 1: 27, 2: 25.6, 3: 4.8, 4: 3.2, 5: 3.1, 6: 6.7 }
    : { 1: 13.4, 2: 13.6, 3: 6.8, 4: 3.8, 5: 3.5, 6: 6.8 };
  const stages = { 3: "R16", 4: "QF", 5: "SF", 6: "Final" };

  function button(g, inner, cls) {
    const matchup = g.slots.map((slot) => label(slot)).join(" × ");
    const decision = g.penalties
      ? '<small class="pk-note">PK ' + g.penalties.join("–") + "</small>"
      : "";
    return (
      '<button class="draw-game ' +
      cls +
      (g.score ? " decided" : "") +
      '" data-game="' +
      g.id +
      '" aria-label="' +
      esc(rounds[g.round] + " · " + matchup) +
      '" title="' +
      esc(matchup) +
      '">' +
      inner +
      decision +
      "</button>"
    );
  }
  function entrant(slot, g, index) {
    const id = resolved(slot),
      t = data.teams[id];
    if (!t) return "";
    const outcome = !g.score
      ? ""
      : resolved(g.id) === id
        ? " advanced"
        : " eliminated";
    return (
      '<span class="entrant' +
      outcome +
      '">' +
      crest(t) +
      '<span class="entry-name">' +
      (t.seed ? "<sup>" + t.seed + "</sup> " : "") +
      esc(t.name) +
      "</span>" +
      (g.score ? '<b class="draw-score">' + g.score[index] + "</b>" : "") +
      "</span>"
    );
  }
  function visit(g, side, firstRow, span) {
    const r = g.round;
    const stagger =
      compact && r === 1
        ? -2.8
        : compact && r === 2 && g.slots.some((s) => games[s])
          ? 3.15
          : 0;
    const pos = {
      x: side === 1 ? centers[r] : 100 - centers[r],
      y: (firstRow + span / 2) * 12.5 + stagger,
      w: widths[r],
    };
    g.slots.forEach((slot, i) => {
      if (!games[slot]) return;
      const half = r === 6 ? (i === 0 ? 1 : -1) : side;
      const sameRow = r <= 2;
      const child = visit(
        games[slot],
        half,
        r === 6 ? 0 : sameRow ? firstRow : firstRow + (i * span) / 2,
        r === 6 ? 8 : sameRow ? span : span / 2,
      );
      const start = child.x + (half * child.w) / 2;
      const end = pos.x - (half * pos.w) / 2;
      const bend = (start + end) / 2;
      // Staggered campus cards turn horizontally in the gap between rows.
      const midY = (child.y + pos.y) / 2;
      const path =
        compact && sameRow
          ? `M${child.x} ${child.y} V${midY} H${pos.x} V${pos.y}`
          : `M${start} ${child.y} H${bend} V${pos.y} H${end}`;
      paths.push(
        `<path data-from="${slot}" data-to="${g.id}" class="${games[slot].score ? "settled" : ""}" d="${path}"/>`,
      );
    });
    const entrants = g.slots.map((slot, i) => entrant(slot, g, i)).join("");
    const inner =
      r <= 2
        ? button(g, entrants, r === 1 ? "first-game" : "campus-game")
        : button(
            g,
            (r === 6 ? icon("cup") : "") +
              '<span class="stage-tag">' +
              stages[r] +
              "</span>" +
              entrants,
            "stage-game",
          );
    nodes.push(
      '<div class="draw-node stage-' +
        r +
        '" style="left:' +
        pos.x +
        "%;top:" +
        pos.y +
        "%;width:" +
        pos.w +
        '%">' +
        inner +
        "</div>",
    );
    return pos;
  }
  visit(final, 1, 0, 8);
  const champion = resolved("C");
  return (
    '<section class="overview"><div class="draw-heading"><div><span class="kicker">2026 TOURNAMENT</span><h2>Full championship draw</h2></div>' +
    '<button class="zoom-draw" data-zoom aria-pressed="' +
    enlarged +
    '">' +
    (enlarged ? "− &nbsp; Fit draw" : "+ &nbsp; Enlarge") +
    "</button></div>" +
    '<div class="poster-frame" tabindex="0" aria-label="Complete tournament bracket"><div class="poster ' +
    (enlarged ? "enlarged" : "") +
    '">' +
    '<div class="poster-caption"><span class="round-key"><b>First</b> → <em>Second</em></span><span>Final · Dec 7 · Orange Beach</span><span class="round-key"><em>Second</em> ← <b>First</b></span></div>' +
    '<div class="draw-map"><svg class="draw-lines" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">' +
    paths.join("") +
    "</svg>" +
    nodes.join("") +
    '</div></div></div><div class="poster-footer"><span>' +
    (champion ? "Champion · " + esc(data.teams[champion].name) + " · " : "") +
    finalsCount +
    ' / 39 games final</span><span>Tap a matchup for details</span><a href="#bracket">Explore bracket ' +
    icon("arrow") +
    "</a></div></section>"
  );
}

matchMedia("(max-width: 760px)").addEventListener("change", () => {
  if (data && route() === "dashboard") render();
});
function findTeamLinks(query) {
  const term = query.trim().toLowerCase();
  const matches = Object.values(data.teams).filter((t) =>
    (t.name + " " + t.id.replaceAll("-", " ")).toLowerCase().includes(term),
  );
  return (
    matches
      .map(
        (t) =>
          '<a href="#bracket/team/' +
          t.id +
          '">' +
          crest(t) +
          esc(t.name) +
          "</a>",
      )
      .join("") || '<span class="no-teams">No matching teams</span>'
  );
}
function teamFinder(team, game) {
  let focus = "";
  if (team && game) {
    const next = Object.values(data.games).find((g) =>
      g.slots.includes(game.id),
    );
    const other = next?.slots.find((s) => s !== game.id);
    focus =
      '<article class="team-focus"><div><span class="kicker">' +
      esc(team.name) +
      "</span><h3>" +
      rounds[game.round] +
      "</h3>" +
      "<p>" +
      dateLabel(game) +
      "</p>" +
      (other && !game.score
        ? "<p>If " + esc(team.name) + " advances: " + esc(label(other)) + "</p>"
        : "") +
      "</div>" +
      card(game) +
      "</article>";
  }
  return (
    '<div class="team-finder"><label for="team-query">Find my team</label><div class="finder-input">' +
    '<input id="team-query" type="search" autocomplete="off" placeholder="Search 40 teams" aria-controls="team-results">' +
    '<div id="team-results" hidden></div></div></div>' +
    focus
  );
}
function board() {
  const [, selected, teamId] = location.hash.split("/");
  const team =
    selected === "team" && Object.hasOwn(data.teams, teamId)
      ? data.teams[teamId]
      : null;
  const game =
    team &&
    Object.values(data.games)
      .filter((g) => g.slots.some((s) => resolved(s) === team.id))
      .sort((a, b) => b.round - a.round)[0];
  finals = selected === "final";
  if (order.includes(Number(selected))) branch = Number(selected);
  if (game) {
    finals = game.round > 3;
    if (!finals) {
      const n = Number(game.id.slice(1));
      branch = Math.min(n, 17 - n);
    }
  }
  const a = branch,
    b = 17 - a;
  const headers = finals ? [4, 5, 6] : [1, 2, 3];
  const boxes = finals
    ? [["Q1", "Q2", "Q3", "Q4"], ["H1", "H2"], ["C"]]
    : [["F" + a], ["S" + a, "S" + b], ["R" + a]];
  const columns = headers
    .map(
      (r, i) =>
        '<div class="column col' +
        i +
        '"><div class="roundhead"><span class="kicker">' +
        (r === 6 ? "TITLE MATCH" : r < 3 ? "CAMPUS SITES" : "ORANGE BEACH") +
        "</span><h3>" +
        rounds[r] +
        "</h3><span>" +
        dates[r] +
        '</span></div><div class="matches">' +
        boxes[i]
          .map(
            (id, j) =>
              '<div class="node n' +
              j +
              (data.games[id].score ? " won" : "") +
              '">' +
              card(data.games[id]) +
              "</div>",
          )
          .join("") +
        "</div></div>",
    )
    .join("");
  return (
    '<section class="board">' +
    teamFinder(team, game) +
    '<div class="boardbar"><div><div class="kicker"><i></i> TOURNAMENT DRAW</div><h2>' +
    (finals ? "Road to the title" : "Opening rounds") +
    '</h2></div><div class="switch"><button data-view="opening" aria-pressed="' +
    !finals +
    '">' +
    icon("bracket") +
    'Opening rounds</button><button data-view="final" aria-pressed="' +
    finals +
    '">' +
    icon("cup") +
    'Final site</button></div></div><div class="drawtools"><div class="branchchoice">' +
    (finals
      ? resolved("C")
        ? "<b>Champion · " + esc(data.teams[resolved("C")].name) + "</b>"
        : "<b>Championship rounds</b>"
      : '<label for="branch">Branch</label><select id="branch">' +
        order
          .map(
            (n) =>
              '<option value="' +
              n +
              '" ' +
              (n === a ? "selected" : "") +
              ">" +
              esc(data.sites[n - 1].city.split(",")[0]) +
              " & " +
              esc(data.sites[16 - n].city.split(",")[0]) +
              "</option>",
          )
          .join("") +
        "</select>") +
    "</div>" +
    mini() +
    '</div><div class="drawscroll" tabindex="0" aria-label="Tournament tree"><div class="tree ' +
    (finals ? "finaltree" : "") +
    '">' +
    columns +
    '</div></div><div class="boardbottom"><span>' +
    icon("bracket") +
    " Select a matchup for game details</span><span>" +
    (finals ? "8 teams · 3 rounds" : "Campus sites → Orange Beach") +
    "</span></div></section>"
  );
}
function teamsPage() {
  const list = Object.values(data.teams).filter((t) =>
    (t.name + " " + t.conference).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    '<section class="directory"><div class="listhead"><h2>Team directory</h2><input id="search" aria-label="Search teams or conferences" placeholder="Search teams or conferences" value="' +
    esc(search) +
    '"></div><div class="teamgrid">' +
    list
      .map(
        (t) =>
          '<button class="teamtile" data-team="' +
          t.id +
          '">' +
          crest(t, "wordmark") +
          "<span><b>" +
          esc(t.name) +
          "</b><small>" +
          esc(t.conference) +
          "</small></span><em>" +
          (t.seed ? "#" + t.seed : "") +
          "</em></button>",
      )
      .join("") +
    "</div>" +
    (!list.length ? "<p>No teams match your search.</p>" : "") +
    "</section>"
  );
}
function gamesPage(isPod) {
  const options = isPod
    ? data.sites.slice(0, 16).map((s, i) => [i, s.city])
    : rounds.slice(1).map((s, i) => [i + 1, s]);
  const key = isPod ? pod : round;
  const list = Object.values(data.games).filter((g) =>
    isPod ? g.site === pod : g.round === round,
  );
  return (
    '<section class="directory"><div class="listhead"><div><div class="kicker">' +
    (isPod ? "HOST SITE" : "GAME SCHEDULE") +
    "</div><h2>" +
    esc(isPod ? data.sites[pod].city : rounds[round]) +
    '</h2></div><select id="group" aria-label="' +
    (isPod ? "Host site" : "Round") +
    '">' +
    options
      .map(
        ([v, s]) =>
          '<option value="' +
          v +
          '" ' +
          (key === v ? "selected" : "") +
          ">" +
          esc(s) +
          "</option>",
      )
      .join("") +
    '</select></div><p class="sub">' +
    esc(isPod ? data.sites[pod].venue : dates[round]) +
    '</p><div class="gamesgrid">' +
    list
      .map(
        (g) =>
          "<article><h3>" +
          esc(isPod ? rounds[g.round] : data.sites[g.site].city) +
          "</h3><p>" +
          dateLabel(g) +
          "</p>" +
          card(g) +
          "</article>",
      )
      .join("") +
    "</div></section>"
  );
}
function render() {
  const page = route();
  document.body.classList.toggle("dashboard-page", page === "dashboard");
  $("#heading").textContent = titles[page];
  document.title = titles[page] + " | Road to Orange Beach · Name TBD";
  document
    .querySelectorAll("nav a")
    .forEach((a) =>
      a.hash === "#" + page
        ? a.setAttribute("aria-current", "page")
        : a.removeAttribute("aria-current"),
    );
  content.innerHTML =
    page === "dashboard"
      ? championshipDraw()
      : page === "bracket"
        ? board()
        : page === "teams"
          ? teamsPage()
          : gamesPage(page === "pods");
  if (dialog.open && chosenGame) details(chosenGame);
}
function details(id) {
  chosenGame = id;
  const g = data.games[id],
    s = data.sites[g.site];
  const scorers = g.scorers
    ?.map((e) => "<li>" + esc(e.minute) + "′ · " + esc(e.name) + "</li>")
    .join("");
  $("#details").innerHTML =
    '<div class="kicker">' +
    rounds[g.round] +
    " · " +
    (g.score ? "Final" : "Scheduled") +
    '</div><h2 id="detailTitle">Match details</h2><div class="versus">' +
    g.slots.map((slot, i) => teamRow(slot, g, i)).join("") +
    "</div>" +
    resultNote(g) +
    "<dl><dt>Date</dt><dd>" +
    dateLabel(g) +
    "</dd><dt>Kickoff</dt><dd>" +
    timePair(g) +
    "</dd><dt>Venue</dt><dd>" +
    esc(s.venue) +
    "<small>" +
    esc(s.city) +
    "</small></dd>" +
    (g.round >= 3
      ? "<dt>Game time</dt><dd>" +
        esc(g.gameTime || "Awaiting match report") +
        "</dd><dt>Scorers</dt><dd>" +
        (scorers ? "<ul>" + scorers + "</ul>" : "Awaiting match report") +
        "</dd>"
      : "") +
    (g.updated
      ? "<dt>Last updated</dt><dd>" +
        esc(
          new Date(g.updated).toLocaleString("en-US", {
            timeZone: "America/Chicago",
          }),
        ) +
        " CT</dd>"
      : "") +
    '</dl><a class="stream" href="' +
    esc(g.streamUrl) +
    '" target="_blank" rel="noopener">Watch on NAIA Network</a>';
  if (route() === "dashboard") {
    const n = Number(id.slice(1));
    const section = g.round > 3 ? "final" : Math.min(n, 17 - n);
    $("#details").insertAdjacentHTML(
      "beforeend",
      '<a class="bracket-jump" href="#bracket/' +
        section +
        '">Follow this matchup in Bracket ' +
        icon("arrow") +
        "</a>",
    );
  }
  if (!dialog.open) dialog.showModal();
}
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
content.onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-zoom")) enlarged = !enlarged;
  if (b.dataset.game) return details(b.dataset.game);
  if (b.dataset.team)
    return details(
      Object.values(data.games).find((g) => g.slots.includes(b.dataset.team))
        .id,
    );
  if (b.dataset.branch || b.dataset.view) {
    location.hash =
      "bracket/" +
      (b.dataset.branch || (b.dataset.view === "final" ? "final" : branch));
    return;
  }
  render();
};
content.onchange = (e) => {
  if (e.target.id === "branch") {
    location.hash = "bracket/" + e.target.value;
    return;
  } else if (e.target.id === "group") {
    if (route() === "pods") pod = Number(e.target.value);
    else round = Number(e.target.value);
  } else return;
  render();
};
function showTeamResults(input) {
  const results = $("#team-results");
  results.innerHTML = findTeamLinks(input.value);
  results.hidden = false;
}
content.addEventListener("focusin", (e) => {
  if (e.target.id === "team-query") showTeamResults(e.target);
});
content.addEventListener("focusout", (e) => {
  if (
    e.target.closest(".team-finder") &&
    e.relatedTarget &&
    !e.relatedTarget.closest(".team-finder")
  )
    $("#team-results").hidden = true;
});
// A mobile tap may blur the input before the result receives its click.
document.addEventListener("pointerdown", (e) => {
  const results = $("#team-results");
  if (results && !e.target.closest(".team-finder")) results.hidden = true;
});
content.addEventListener("keydown", (e) => {
  if (!e.target.closest(".team-finder")) return;
  if (e.key === "Escape") {
    $("#team-query").focus();
    $("#team-results").hidden = true;
  }
  if (e.target.id === "team-query" && ["Enter", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
    const first = $("#team-results a");
    if (e.key === "Enter") first?.click();
    else first?.focus();
  }
});
content.addEventListener("click", (e) => {
  if (e.target.closest("#team-results a")) $("#team-results").hidden = true;
});
content.oninput = (e) => {
  if (e.target.id === "team-query") return showTeamResults(e.target);
  if (e.target.id === "search") {
    search = e.target.value;
    const caret = e.target.selectionStart;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(caret, caret);
  }
};
window.addEventListener("hashchange", () => {
  dialog.close();
  if (route() === "dashboard") enlarged = false;
  if (data) render();
  track();
  window.scrollTo(0, 0);
});
function track() {
  if (window.goatcounter?.count)
    window.goatcounter.count({ path: location.pathname + route() });
}
async function refresh() {
  try {
    const response = await fetch("data/bracket-2026.json", {
      cache: "no-store",
    });
    if (!response.ok) throw Error();
    const raw = await response.text();
    if (raw !== rawData) {
      const next = JSON.parse(raw);
      if (!next.games.C || !next.teams) throw Error();
      const input =
        document.activeElement?.id === "team-query"
          ? document.activeElement
          : null;
      data = next;
      rawData = raw;
      render();
      if (input && $("#team-query")) {
        $("#team-query").value = input.value;
        $("#team-query").focus();
        $("#team-query").setSelectionRange(
          input.selectionStart,
          input.selectionEnd,
        );
      }
    }
  } catch {
    if (!data)
      content.innerHTML =
        '<p>The draw could not load. <button onclick="location.reload()">Retry</button></p>';
  }
}
(async function poll() {
  await refresh();
  if (Date.now() < Date.parse("2026-12-08T06:00:00Z")) setTimeout(poll, 30000);
})();
