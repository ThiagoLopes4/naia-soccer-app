"""Keep checking a matchday from one Actions runner while fixtures remain open."""
from datetime import datetime
import json
import os
import subprocess
import time

from scores import CT, DATA, update_national, valid_date


def check(day):
    subprocess.run(["git", "pull", "--quiet", "--ff-only", "origin", "main"], check=True)
    data = json.loads(DATA.read_text())
    pending = [g["id"] for g in data["games"].values() if not g["score"] and valid_date(g, day)]
    if not pending:
        print(f"{day}: no pending fixtures.", flush=True)
        return False

    issues = update_national(data, day)
    for issue in issues:
        print(issue, flush=True)
    ready = [gid for gid in pending if data["games"][gid]["score"]]
    print(f"{day}: {len(pending)} pending, ready for publication: {ready}", flush=True)
    if ready:
        # The publisher revalidates against the current main branch before writing.
        subprocess.run(["gh", "workflow", "run", "pages.yml", "--ref", "main",
                        "--repo", os.environ["GITHUB_REPOSITORY"]], check=True)
    return True


def main():
    day = datetime.now(CT).date().isoformat()
    deadline = time.monotonic() + 4 * 3600
    while time.monotonic() < deadline and datetime.now(CT).date().isoformat() == day:
        started = time.monotonic()
        try:
            if not check(day):
                break
        except (OSError, ValueError, subprocess.CalledProcessError) as error:
            print(f"Check failed, retrying in five minutes: {error}", flush=True)
        time.sleep(max(0, min(started + 300, deadline) - time.monotonic()))


if __name__ == "__main__":
    main()
