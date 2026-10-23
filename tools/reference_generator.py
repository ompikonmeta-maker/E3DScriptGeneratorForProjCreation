#!/usr/bin/env python3
"""Reference implementation of the E3D Setup Generator engine (Python 3 stdlib only).

It is the executable form of docs/SPEC.md sections 4-6. The HTML tool must produce the same
model, validation results and .mac text for the same config.

Usage:
  python tools/reference_generator.py presets/zrf.config.json --out build/zrf
  python tools/reference_generator.py presets/zrf.config.json --check fixtures/zrf
"""
import argparse, json, os, re, sys

TOKEN_RE = re.compile(r"\{([A-Za-z_][A-Za-z0-9_.]*)((?:\|[a-z]+(?::[0-9]+)?)*)\}")
MULTIWRITE_TYPES = {"DESI", "CATA", "DRAFT", "ISODRAFT"}          # fact 1.4
NAME_OK_RE = re.compile(r"^/[A-Z0-9-]+$")                          # chars outside this: warning (sec 9)


class Cfg:
    def __init__(self, data):
        self.d = data
        self.attrs = {a["id"]: a for a in data["attributes"]}
        self.by_name = {a["name"]: a for a in data["attributes"]}
        self.rows = {a["id"]: {r["kode"]: r for r in a["rows"]} for a in data["attributes"]}

    def col(self, attr_id, col_id):
        for c in self.attrs[attr_id]["columns"]:
            if c["id"] == col_id:
                return c
        raise KeyError(f"column {attr_id}.{col_id} not defined")

    def role(self, role):
        return [a for a in self.d["attributes"] if a["role"] == role]


def resolve(cfg, path, ctx):
    parts = path.split(".")
    head = parts[0]
    if head == "PROJECT":
        return cfg.d["project"][parts[1]]
    if head in ("SITE", "INDEX"):
        return ctx[head]
    if head not in cfg.by_name:
        raise KeyError(f"unknown token head '{head}'")
    attr = cfg.by_name[head]
    if head not in ctx:
        raise KeyError(f"token '{path}' not available in this template context")
    row, attr_id = ctx[head], attr["id"]
    if len(parts) == 1:
        raise KeyError(f"token '{path}' needs a column")
    for i, seg in enumerate(parts[1:], 1):
        c = cfg.col(attr_id, seg)
        val = row.get(seg)
        if c["type"] == "ref" and i < len(parts) - 1:
            row, attr_id = cfg.rows[c["target"]][val], c["target"]
            continue
        if i != len(parts) - 1:
            raise KeyError(f"'{seg}' in '{path}' is not a reference column")
        return val
    return None


def apply_filters(val, filters):
    for f in [x for x in filters.split("|") if x]:
        name, _, arg = f.partition(":")
        if name == "upper":
            val = str(val).upper()
        elif name == "lower":
            val = str(val).lower()
        elif name == "pad":
            val = str(val).zfill(int(arg))
        else:
            raise ValueError(f"unknown filter '{name}'")
    return val


def render(cfg, tpl, ctx):
    return TOKEN_RE.sub(lambda m: str(apply_filters(resolve(cfg, m.group(1), ctx), m.group(2))), tpl)


def evaluate(expr):
    """Integer arithmetic: numbers, + - * /, parentheses. No eval()."""
    toks = re.findall(r"\d+|[-+*/()]", expr)
    if "".join(toks) != re.sub(r"\s+", "", expr):
        raise ValueError(f"invalid expression '{expr}'")
    pos = 0

    def peek():
        return toks[pos] if pos < len(toks) else None

    def take():
        nonlocal pos
        pos += 1
        return toks[pos - 1]

    def factor():
        t = take()
        if t == "(":
            v = expr_()
            take()
            return v
        if t == "-":
            return -factor()
        return int(t)

    def term():
        v = factor()
        while peek() in ("*", "/"):
            op = take()
            r = factor()
            if op == "*":
                v *= r
            else:
                if v % r:
                    raise ValueError("non-integer division")
                v //= r
        return v

    def expr_():
        v = term()
        while peek() in ("+", "-"):
            v = v + term() if take() == "+" else v - term()
        return v

    v = expr_()
    if pos != len(toks):
        raise ValueError(f"invalid expression '{expr}'")
    return v


def matches(cfg, when, ctx):
    for w in when:
        v = resolve(cfg, w["token"], ctx)
        if w["op"] == "eq" and v != w["value"]:
            return False
        if w["op"] == "ne" and v == w["value"]:
            return False
        if w["op"] == "in" and v not in w["value"]:
            return False
    return True


def build_model(cfg):
    d, t, comb = cfg.d, cfg.d["templates"], cfg.d["combination"]
    row_attr, col_attr = cfg.attrs[comb["rowAttr"]], cfg.attrs[comb["colAttr"]]
    group_col = comb.get("groupBy")
    group_attr = cfg.attrs[cfg.col(col_attr["id"], group_col)["target"]] if group_col else None
    excluded = {(a, b) for a, b in comb.get("excluded", [])}
    discs = sorted(row_attr["rows"], key=lambda r: r["urutan"])
    model = {"disciplines": []}
    for dr in discs:
        cells, idx = [], 0
        for ar in col_attr["rows"]:
            if (dr["kode"], ar["kode"]) in excluded:
                continue
            idx += 1
            ctx = {row_attr["name"]: dr, col_attr["name"]: ar, "INDEX": idx}
            if group_attr:
                ctx[group_attr["name"]] = cfg.rows[group_attr["id"]][ar[group_col]]
            cell = {
                "ctx": ctx,
                "group": ar[group_col] if group_col else None,
                "db": render(cfg, t["dbName"], ctx),
                "desc": render(cfg, t["dbDesc"], ctx),
                "dbno": evaluate(render(cfg, t["dbNo"], ctx)),
                "pos": evaluate(render(cfg, t["mdbPos"], ctx)),
                "site": render(cfg, t["site"], ctx),
            }
            cell["team"] = cell["db"].split("/")[0]
            ctx["SITE"] = cell["site"]
            zones, targeted = [], False
            for rule in d.get("zoneRules", []):
                if not matches(cfg, rule["when"], ctx):
                    continue
                if any(w["token"].split(".")[0] == row_attr["name"] for w in rule["when"]):
                    targeted = True
                if rule.get("forEach"):
                    fa = cfg.attrs[rule["forEach"]]
                    for fr in fa["rows"]:
                        zctx = dict(ctx)
                        zctx[fa["name"]] = fr
                        zones += [render(cfg, p, zctx) for p in rule["patterns"]]
                else:
                    zones += [render(cfg, p, ctx) for p in rule["patterns"]]
            cell["zones"] = zones
            cell["targeted"] = targeted
            cells.append(cell)
        if not cells:
            continue
        dctx = {row_attr["name"]: dr}
        model["disciplines"].append({
            "row": dr, "ctx": dctx, "cells": cells,
            "sepDiscipline": render(cfg, t["sepDiscipline"], dctx) if t.get("sepDiscipline") else None,
            "groupSeps": {c["group"]: render(cfg, t["sepGroup"], c["ctx"]) for c in cells}
            if (group_attr and group_attr["role"] == "separator" and t.get("sepGroup")) else {},
        })
    return model


def validate(cfg, model):
    issues = []

    def add(sev, ref, msg):
        issues.append({"severity": sev, "ref": ref, "message": msg})

    d = cfg.d
    defaults = d["dbDefaults"]
    if defaults["access"] == "MULTIWRITE" and defaults["type"] not in MULTIWRITE_TYPES:
        add("error", "1.4", f"type {defaults['type']} cannot be MULTIWRITE")
    teams = cfg.rows[cfg.role("team")[0]["id"]] if cfg.role("team") else {}
    cells = [c for dd in model["disciplines"] for c in dd["cells"]]
    seen_no, seen_db, seen_pos, names = {}, set(), {}, {}
    for c in cells:
        n = c["dbno"]
        if not (1 <= n <= 7000 or 10000 <= n <= 250000):
            add("error", "1.3", f"DBNO {n} ({c['db']}) outside 1-7000 / 10000-250000")
        if n in seen_no:
            add("error", "1.3", f"DBNO {n} used by {seen_no[n]} and {c['db']}")
        seen_no[n] = c["db"]
        if c["db"] in seen_db:
            add("error", "dup", f"duplicate DB name {c['db']}")
        seen_db.add(c["db"])
        if c["team"] not in teams:
            add("error", "1.12", f"owning team {c['team']} of {c['db']} is not in the Team table")
    positions = [(c["pos"], c["db"]) for c in cells] + \
                [(r["pos"], r["db"]) for r in d.get("referenceDbs", []) if r["active"] and r.get("pos") is not None]
    for p, db in positions:
        if not (1 <= p <= 5000):
            add("error", "sec2", f"MDB position {p} ({db}) outside 1-5000")
        if p in seen_pos:
            add("error", "sec2", f"MDB position {p} used by {seen_pos[p]} and {db}")
        seen_pos[p] = db
    if len(positions) > 1000:
        add("error", "1.7", f"{len(positions)} current DBs in one MDB (max 1000)")
    for dd in model["disciplines"]:
        groups_seen, last = [], None
        for c in dd["cells"]:
            if c["group"] != last:
                if c["group"] in groups_seen:
                    add("error", "3.4", f"group {c['group']} is not contiguous in {dd['row']['kode']}")
                groups_seen.append(c["group"])
                last = c["group"]
        elems = [dd["sepDiscipline"]] + list(dd["groupSeps"].values()) + [c["site"] for c in dd["cells"]]
        for c in dd["cells"]:
            elems += c["zones"]
        for e in elems:
            if e is None:
                continue
            if not e.startswith("/"):
                add("error", "3.5", f"name {e} does not start with /")
            elif e != e.upper():
                add("warning", "3.5", f"name {e} is not upper case (E3D is case-sensitive)")
            elif not NAME_OK_RE.match(e):
                add("warning", "sec9", f"name {e} uses characters other than A-Z, 0-9, - (untested)")
            if e in names:
                add("error", "dup", f"duplicate element name {e}")
            names[e] = True
    if any(c["zones"] for c in cells):
        add("warning", "sec9", "NEW ZONE after navigating to a site is not yet tested in ZRF")
    for dd in model["disciplines"]:
        if not any(c["targeted"] for c in dd["cells"]):
            add("warning", "V20", f"no zone rule targets row {dd['row']['kode']}")
    for r in d.get("referenceDbs", []):
        if r["active"] and r.get("pos") is None:
            add("error", "sec2", f"reference DB {r['db']} is active but has no position")
    return issues


def lines_join(lines, eol):
    return eol.join(lines) + eol


def header(title, notes):
    bar = "$* " + "=" * 59
    return [bar, f"$* {title}"] + [f"$* {n}" for n in notes] + [bar, "$*"]


def generate(cfg, model):
    d, t, p = cfg.d, cfg.d["templates"], cfg.d["project"]
    eol = "\r\n" if p.get("lineEnding", "CRLF") == "CRLF" else "\n"
    mdb = d["combination"]["mdb"]
    defaults = d["dbDefaults"]
    files = {}
    pctx = {}
    gen = f"Generated by E3D Setup Generator - {p['code']} - {p['target']}"

    team_attr = cfg.role("team")[0]
    teams = team_attr["rows"]
    new_teams = [r for r in teams if not r.get("existing")]
    old_teams = [r for r in teams if r.get("existing")]
    L = header(f"{p['code']} - STEP 0 - TEAMS - ADMIN", [gen, "Run once, before the first discipline."])
    L.append(f"$* --- {len(new_teams)} new teams ---")
    for r in new_teams:
        L.append(f"CREATE TEAM {r['kode']} DESC '{r['desc']}'")
    for r in new_teams:
        if r.get("anggota"):
            L.append(f"SET TEAM {r['kode']}")
            L += [f"TADD {u}" for u in r["anggota"]]
    if d["output"].get("includeExistingTeamsBlock") and old_teams:
        L += ["$*", "$* --- existing teams: only if they were deleted (normally keep) ---"]
        L += [f"$* CREATE TEAM {r['kode']} DESC '{r['desc']}'" for r in old_teams]
        for r in old_teams:
            if r.get("anggota"):
                L.append(f"$* SET TEAM {r['kode']}")
                L += [f"$* TADD {u}" for u in r["anggota"]]
    files[f"{t['teamsFolder']}/{render(cfg, t['teamsFile'], pctx)}"] = lines_join(L, eol)

    for dd in model["disciplines"]:
        ctx, cells, name = dd["ctx"], dd["cells"], dd["row"]["desc"].upper()
        folder = render(cfg, t["discFolder"], ctx)
        pos = f"{cells[0]['pos']}-{cells[-1]['pos']}"
        L = header(f"{name} ({cells[0]['team']}) - STEP B1 - ADMIN: CREATE {len(cells)} DB + MDB",
                   [gen, "Team must exist (00-TEAMS). If a CREATE line fails: recreate that DB, continue.",
                    f"MDB positions {pos}."])
        for c in cells:
            L.append(f"CREATE DB {c['db']} {defaults['type']} ACCESS {defaults['access']} CLAIM {defaults['claim']} "
                     f"DBNO {c['dbno']} DESC '{c['desc']}'")
        L += ["$*", f"SET MDB {mdb}"] + [f"ADD {c['db']} {c['pos']}" for c in cells]
        files[f"{folder}/{render(cfg, t['b1File'], ctx)}"] = lines_join(L, eol)

        L = header(f"{name} - STEP B2 - DESIGN: separators + {len(cells)} sites (display order)",
                   [gen, "DB given once per DB (first site); next lines without DB go to the same DB.",
                    "Re-enter DESIGN after B1."])
        last_db, last_group = None, object()

        def site_line(n, db):
            nonlocal last_db
            s = f"NEW SITE {n}" + (f" DB {db}" if db != last_db else "")
            last_db = db
            return s
        if dd["sepDiscipline"]:
            L.append(site_line(dd["sepDiscipline"], cells[0]["db"]))
        for c in cells:
            if c["group"] != last_group:
                last_group = c["group"]
                if c["group"] in dd["groupSeps"]:
                    L.append(site_line(dd["groupSeps"][c["group"]], c["db"]))
            L.append(site_line(c["site"], c["db"]))
        L += ["$*", "SAVEWORK"]
        files[f"{folder}/{render(cfg, t['b2File'], ctx)}"] = lines_join(L, eol)

        if any(c["zones"] for c in cells):
            L = header(f"{name} - STEP B3 - DESIGN: zones",
                       [gen, "WARNING: NEW ZONE after navigating to a site is not yet tested (facts sec 9).",
                        "Each block: go to SITE, NEW ZONE."])
            for c in cells:
                if c["zones"]:
                    L.append(c["site"])
                    L += [f"NEW ZONE {z}" for z in c["zones"]]
            L += ["$*", "SAVEWORK"]
            files[f"{folder}/{render(cfg, t['b3File'], ctx)}"] = lines_join(L, eol)

    refs = d.get("referenceDbs", [])
    if d["output"].get("includeReference") and refs:
        L = header("REFERENCE DBs - ADMIN: add to MDB", [gen, "Run AFTER all disciplines."])
        L.append(f"SET MDB {mdb}")
        for r in refs:
            L.append(f"ADD {r['db']} {r['pos']}" if r["active"] else f"$* ADD {r['db']}   <- {r['note']}")
        files[f"{t['refFolder']}/{render(cfg, t['refFile'], pctx)}"] = lines_join(L, eol)

    if d["output"].get("includeFixup"):
        L = header("MDB FIX-UP - ADMIN: CURRENT db n for all (final order)",
                   [gen, "Use only if the MDB order is wrong.", "A DB that is not in the MDB stops the macro: ADD it first."])
        L.append(f"SET MDB {mdb}")
        L += [f"CURRENT {c['db']} {c['pos']}" for dd in model["disciplines"] for c in dd["cells"]]
        L += [f"CURRENT {r['db']} {r['pos']}" for r in refs if r["active"]]
        files[f"{t['fixupFolder']}/{render(cfg, t['fixupFile'], pctx)}"] = lines_join(L, eol)
    return files


def commands(text):
    return [l.strip() for l in text.splitlines() if l.strip() and not l.strip().startswith("$*")]


def check(files, fixtures_dir):
    ok = True
    for root, _, names in os.walk(fixtures_dir):
        for n in sorted(names):
            fp = os.path.join(root, n)
            rel = os.path.relpath(fp, fixtures_dir).replace(os.sep, "/")
            prefix = ".prefix." in n
            target = rel.replace(".prefix.mac", ".mac")
            exp = commands(open(fp, encoding="utf-8").read())
            if target not in files:
                print(f"FAIL {target}: not generated")
                ok = False
                continue
            got = commands(files[target])
            cmp = got[:len(exp)] if prefix else got
            if cmp == exp:
                print(f"PASS {target}{' (prefix ' + str(len(exp)) + ' lines)' if prefix else ''}")
            else:
                ok = False
                for i, (a, b) in enumerate(zip(cmp, exp)):
                    if a != b:
                        print(f"FAIL {target} line {i + 1}:\n  got: {a}\n  exp: {b}")
                        break
                else:
                    print(f"FAIL {target}: {len(cmp)} lines vs expected {len(exp)}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config")
    ap.add_argument("--out")
    ap.add_argument("--check")
    a = ap.parse_args()
    cfg = Cfg(json.load(open(a.config, encoding="utf-8")))
    model = build_model(cfg)
    issues = validate(cfg, model)
    files = generate(cfg, model)
    cells = [c for dd in model["disciplines"] for c in dd["cells"]]
    seps = sum((1 if dd["sepDiscipline"] else 0) + len(dd["groupSeps"]) for dd in model["disciplines"])
    print(f"teams={len(cfg.role('team')[0]['rows'])} dbs={len(cells)} sites={len(cells)} separators={seps} "
          f"zones={sum(len(c['zones']) for c in cells)} refs_active={sum(1 for r in cfg.d.get('referenceDbs', []) if r['active'])}")
    for dd in model["disciplines"]:
        print(f"  {dd['row']['kode']}: zones={sum(len(c['zones']) for c in dd['cells'])}")
    errs = [i for i in issues if i["severity"] == "error"]
    print(f"errors={len(errs)} warnings={len(issues) - len(errs)}")
    for i in issues:
        print(f"  [{i['severity']}] ({i['ref']}) {i['message']}")
    if a.out:
        for rel, text in files.items():
            fp = os.path.join(a.out, rel)
            os.makedirs(os.path.dirname(fp), exist_ok=True)
            with open(fp, "w", encoding="ascii", newline="") as f:
                f.write(text)
        print(f"wrote {len(files)} files to {a.out}")
    if a.check:
        sys.exit(0 if check(files, a.check) and not errs else 1)


if __name__ == "__main__":
    main()
