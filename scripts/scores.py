"""Apply men's soccer finals to the 2026 draw. Unrecognized results stay in review."""
import argparse
from collections import defaultdict
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
import html
import json
import os
from pathlib import Path
import re
import unicodedata
import urllib.parse
import urllib.request
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site/data/bracket-2026.json"
SCOREBOARD = "https://www.naia.org/wp-json/naia-live-scoreboard/v1/events"
CT = ZoneInfo("America/Chicago")
WINDOWS = {3: ("2026-11-30", "2026-12-01"), 4: ("2026-12-02", "2026-12-03")}
# Normalize common state qualifiers while retaining distinctions between the two Bethels.
STATES = {"indiana":"in","ind":"in","tennessee":"tn","tenn":"tn","kansas":"ks",
          "kan":"ks","calif":"ca","iowa":"ia","nebraska":"ne","neb":"ne",
          "ala":"al","ga":"ga","okla":"ok","ill":"il","miss":"ms","mont":"mt","ohio":"oh"}

def canonical(name):
    name = re.sub(r"^(?:#\d+|\(\d+\))\s*", "", name)
    name = unicodedata.normalize("NFKD", name).encode("ascii","ignore").decode().lower()
    words = re.findall(r"[a-z0-9]+", name)
    return "".join(STATES.get(word, word) for word in words)

def winner(data, slot):
    if slot in data["teams"]:
        return slot
    game = data["games"][slot]
    result = game["penalties"] or game["score"]
    return winner(data, game["slots"][int(result[1] > result[0])]) if result else None

def valid_date(game, day):
    if game["date"]:
        return game["date"] == day
    start, end = WINDOWS[game["round"]]
    return start <= day <= end

def validate(score, pk):
    if len(score) != 2 or any(type(n) is not int or not 0 <= n <= 20 for n in score):
        raise ValueError("Review the game score")
    if pk is not None and (len(pk) != 2 or any(type(n) is not int or not 0 <= n <= 30 for n in pk) or pk[0] == pk[1]):
        raise ValueError("Review the shootout")
    if (score[0] == score[1]) != (pk is not None):
        raise ValueError("A drawn knockout game requires a separate decisive shootout")

def apply(data, gid, score, pk, manual=False, overtime=False, source="PrestoSports RSS"):
    validate(score, pk)
    g = data["games"][gid]
    if not all(winner(data,s) for s in g["slots"]):
        raise ValueError("Both entrants must be confirmed")
    if g["score"] == score and g["penalties"] == pk and bool(g.get('overtime')) == overtime:
        return
    if g["score"] and not manual:
        raise ValueError("Conflicting final requires manual review")
    earlier = winner(data,gid)
    decider = pk or score
    later = winner(data,g["slots"][int(decider[1] > decider[0])])
    if earlier and earlier != later and any(gid in game["slots"] and game["score"] for game in data["games"].values()):
        raise ValueError("Review downstream results before changing an advancing team")
    g.update(score=score,penalties=pk,overtime=overtime,updated=datetime.now(timezone.utc).isoformat(),
             source="manual" if manual else source)

def clean(raw):
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", raw or "")).split())

def candidates(text, teams, aliases):
    # Parse only complete, final score lines. Do not guess via substring matches.
    text = re.sub(r"^\s*\(?men.s soccer\)?\s*[:\-]?\s*","",text,flags=re.I)
    text = re.sub(r"\s*[(,|\-]*\bfinal\b(?:\s*/\s*(?:2?OT))?[).\s]*$","",text,flags=re.I).strip(" ,")
    patterns = [r"(.+?)\s+(\d+)\s*[,;]\s*(.+?)\s+(\d+)",
                r"(.+?)\s*\((\d+)\)\s*(?:at|vs\.?|,)\s*(.+?)\s*\((\d+)\)"]
    for pattern in patterns:
        m = re.fullmatch(pattern,text,re.I)
        if m:
            name1,s1,name2,s2 = m.groups()
            ids = [aliases.get(canonical(re.sub(r"^#\d+\s+","",name))) for name in (name1,name2)]
            if all(i in teams for i in ids) and ids[0] != ids[1]:
                return ids,[int(s1),int(s2)]
    return None

def school_result(item, title, aliases):
    """A Presto W/L score is from the school perspective regardless of title order."""
    ns = "{http://www.prestosports.com/rss/schedule}"
    fields = re.fullmatch(r"(.+?),\s*(.+?),\s*(\d+)\s*[-–]\s*(\d+)", title)
    result = re.fullmatch(r"([WL]),\s*(\d+)-(\d+)", clean(item.findtext(ns+"score")))
    if not fields or not result:
        return None
    first, second, a, b = fields.groups()
    opponent = clean(item.findtext(ns+"opponent")).split(" @ ")[0]
    opponent = aliases.get(canonical(re.sub(r"^(at|vs\.?)\s+", "", opponent,flags=re.I)))
    ids = [aliases.get(canonical(n)) for n in (first,second)]
    if None in ids or opponent not in ids or ids[0] == ids[1]:
        return None
    mark, school, away = result.groups()
    score = [int(school),int(away)]
    if sorted(score) != sorted([int(a),int(b)]) or (score[0] > score[1]) != (mark == "W"):
        return None
    if opponent == ids[0]:
        score.reverse()
    return ids, score

def ingest(data, xml):
    root = ET.fromstring(xml)
    if root.find("channel") is None:
        raise ValueError("Source did not return a schedule RSS channel")
    issues, proposals = [], defaultdict(set)
    aliases = {}
    for tid,t in data["teams"].items():
        for name in (t["team"],t["name"]):
            aliases[canonical(name)] = tid
    for item in root.findall("./channel/item"):
        title, desc = [clean(item.findtext(k)) for k in ("title","description")]
        text = title+" "+desc
        if not re.search(r"\bFinal\b",text,re.I):
            continue
        try:
            stamp = parsedate_to_datetime(item.findtext("pubDate") or "")
            if stamp.tzinfo is None:
                raise ValueError("Missing timezone in feed")
            day = stamp.astimezone(CT).date().isoformat()
            if not "2026-11-19" <= day <= "2026-12-07":
                continue
            if re.search(r"\b(penalties|pk[s]?|shootout|penalty kicks|postponed|cancelled|exhibition|forfeit)\b",text,re.I):
                raise ValueError("Verify the result and separate any shootout")
            parsed = school_result(item,title,aliases) or candidates(title,data["teams"],aliases) or candidates(desc,data["teams"],aliases)
            if not parsed:
                raise ValueError("Unrecognized final score format or participants")
            ids, score = parsed
            matches = [g for g in data["games"].values() if valid_date(g,day) and
                       set(winner(data,s) for s in g["slots"]) == set(ids)]
            if len(matches) != 1:
                raise ValueError("Teams and game date did not match a confirmed fixture")
            game = matches[0]
            if winner(data,game["slots"][0]) != ids[0]:
                score.reverse()
            validate(score,None)
            proposals[game["id"]].add((*score,bool(re.search(r"\b(?:2?OT|overtime)\b",text,re.I))))
        except (ValueError,TypeError,OverflowError) as exc:
            issues.append(f"{title}: {exc}")
    for gid,proposed in proposals.items():
        try:
            if len(proposed) != 1:
                raise ValueError("Multiple conflicting records")
            a,b,ot = next(iter(proposed))
            apply(data,gid,[a,b],None,overtime=ot)
        except ValueError as exc:
            issues.append(f"{gid}: {exc}")
    return issues

def national_events(day):
    events = []
    page = 1
    while True:
        query = urllib.parse.urlencode(dict(sport="Men's Soccer", day=day, page=page, per_page=16))
        with urllib.request.urlopen(SCOREBOARD + "?" + query, timeout=25) as response:
            payload = json.load(response)
        if (payload.get("sport") != "Men's Soccer" or payload.get("day") != day
                or payload.get("page") != page or not isinstance(payload.get("events"), list)
                or type(payload.get("has_more")) is not bool):
            raise ValueError(f"{day}: unexpected national scoreboard response")
        rows = payload["events"]
        if any(not isinstance(row, dict) or row.get("day_key") != day for row in rows):
            raise ValueError(f"{day}: invalid event or date")
        events.extend(rows)
        if not payload["has_more"]:
            if len(events) != payload.get("total"):
                raise ValueError(f"{day}: incomplete national scoreboard")
            ids = [event.get("event_id") for event in events]
            if any(not isinstance(eid, str) or not eid for eid in ids) or len(set(ids)) != len(ids):
                raise ValueError(f"{day}: missing or duplicate event IDs")
            return events
        if not rows or len(events) >= payload["total"]:
            raise ValueError(f"{day}: inconsistent pagination")
        page += 1


def national_results(data, day, events):
    aliases = {canonical(name): tid for tid, team in data["teams"].items()
               for name in (team["name"], team["team"])}
    for label, tid in (("Texas A&M University- San Antonio", "texas-am-san-antonio"),
                       ("WVU Tech (WV)", "wvu-tech"), ("Indiana Wesleyan (IN)", "indiana-wesleyan")):
        aliases[canonical(label)] = tid
    by_fixture = defaultdict(list)
    issues = []
    for event in events:
        names = [event.get(f"team{i}_name") for i in (1, 2)]
        ids = [aliases.get(canonical(name)) if isinstance(name, str) else None for name in names]
        matches = [g for g in data["games"].values() if valid_date(g, day)
                   and None not in ids and set(ids) == {winner(data, s) for s in g["slots"]}]
        if len(matches) == 1:
            by_fixture[matches[0]["id"]].append((event, ids))
        elif event.get("status") == "Final":
            issues.append(f"{day} {names}: final with unconfirmed fixture or participants")

    for gid, records in by_fixture.items():
        if not any(event.get("status") == "Final" for event, _ in records):
            continue
        try:
            if len(records) != 1:
                raise ValueError("Duplicate fixture records")
            event, ids = records[0]
            label = event.get("time_label")
            if label not in ("Final", "Final/OT", "Final/2OT"):
                raise ValueError("Verify the result and any shootout separately")
            values = [str(event.get(f"team{i}_score")) for i in (1, 2)]
            if not all(re.fullmatch("[0-9]{1,2}", v) for v in values):
                raise ValueError("Missing or non-numeric final score")
            score = [int(v) for v in values]
            if winner(data, data["games"][gid]["slots"][0]) != ids[0]:
                score.reverse()
            apply(data, gid, score, None, overtime=label != "Final", source="NAIA national scoreboard")
        except ValueError as exc:
            issues.append(f"{day} {gid}: {exc}")
    return issues


def update_national(data, today):
    days = {g["date"] for g in data["games"].values() if g["date"]}
    for start, end in WINDOWS.values():
        days.update((start, end))
    issues = []
    for day in sorted(d for d in days if d <= today):
        issues.extend(national_results(data, day, national_events(day)))
    return issues


def save(data):
    new = json.dumps(data,ensure_ascii=False,indent=2)+"\n"
    if new != DATA.read_text():
        temp = DATA.with_suffix(".tmp")
        temp.write_text(new)
        temp.replace(DATA)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--manual",metavar="GAME_ID")
    ap.add_argument("--score",nargs=2,type=int)
    ap.add_argument("--penalties",nargs=2,type=int)
    ap.add_argument("--overtime",action="store_true")
    ap.add_argument("--feed-file",type=Path)
    args = ap.parse_args()
    data = json.loads(DATA.read_text())
    if args.manual:
        if args.manual not in data["games"] or args.score is None:
            ap.error("Supply a game ID and --score HOME AWAY")
        apply(data,args.manual,args.score,args.penalties,True,args.overtime)
    else:
        if not args.feed_file and not date(2026,11,19)<=datetime.now(CT).date()<=date(2026,12,7):
            return
        if args.feed_file:
            issues = ingest(data, args.feed_file.read_bytes())
        elif os.environ.get("SCORE_FEED_URL"):
            req = urllib.request.Request(os.environ["SCORE_FEED_URL"],headers={"Accept":"application/rss+xml"})
            with urllib.request.urlopen(req,timeout=30) as response:
                issues = ingest(data, response.read())
        else:
            issues = update_national(data, datetime.now(CT).date().isoformat())
        if issues:
            Path("score-review.txt").write_text("\n".join(issues)+"\n")
            print(f"{len(issues)} records held for review")
    save(data)

if __name__ == "__main__":
    main()
