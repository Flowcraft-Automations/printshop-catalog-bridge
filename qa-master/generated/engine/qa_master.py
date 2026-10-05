#!/usr/bin/env python3
"""
QA Master — selector, runners, report.

One file, standard library only. It shells out to `psql` rather than taking a
driver dependency, because the workflow already has psql and a dependency is a
thing that can rot.

  qa-master select   --profile P --catalog C [--json]
  qa-master run      --profile P --catalog C --db URL [--repo DIR]
  qa-master agent    --profile P --catalog C [--out AGENTS.md]
  qa-master sync     --from QA_MASTER_REPO [--ref REF]     the engine at the pin
  qa-master resolve                                        -> generated/ruleset.lock.json
  qa-master verify   [--agent AGENTS.md]                   the lock, the engine, the layer
  qa-master self-test

The selector is pure: same profile and catalog produce the same ruleset hash,
always. No network, no clock, no filesystem.

In a client, sync, resolve and verify find every file by the layout, under
--root (default: the current directory).
"""
from __future__ import annotations
import argparse, datetime, fnmatch, glob, hashlib, json, os, re, subprocess, sys

BINARY_VERSION = "0.2.3"
REPORT_SCHEMA  = "report/1"

# ── outcomes ────────────────────────────────────────────────────────────────
# Six, and none of them collapses into another. `vacuous` is a defect and
# `not_applicable` is a declaration; merging them recreates the problem the
# field exists to solve. `unprovable` says "write a counterexample" and
# `unrunnable` says "give me access" — different owner, different action.
PASS, FAIL, VACUOUS, NOT_APPLICABLE, UNPROVABLE, UNRUNNABLE = (
    "pass", "fail", "vacuous", "not_applicable", "unprovable", "unrunnable")
# What blocks, by severity. `vacuous` blocks an advisory rule too (decision
# 014): a check that examined nothing is a hole, not advice. Until catalog
# 0.2.0 only blocking rules could block, and an advisory rule that found
# nothing to look at read as advice that had been given. A rule that declares
# `empty_population` is the exception, until the date it gives.
BLOCKING_OUTCOMES = {
    "blocking": {FAIL, VACUOUS, UNPROVABLE, UNRUNNABLE},
    "advisory": {VACUOUS},
}
# A report is decided by the rule of its catalog, so one written before 0.2.0
# still reads as it was decided then: only a blocking rule blocked.
BLOCKING_OUTCOMES_BEFORE_0_2 = {
    "blocking": {FAIL, VACUOUS, UNPROVABLE, UNRUNNABLE},
}

# ── where files are ─────────────────────────────────────────────────────────
# A param names a file in one of four ways (decision 006): `$engine/...`, a
# file shipped with the engine; `$client/...`, under the client folder;
# `$<profile key>`; or a path in the client's repository outside that folder.
# The first two are never read from the profile. `$engine` is the folder this
# file runs from, which in a client is qa-master/generated/engine/, where sync
# put it. `$client` is the layout's root in the repository being checked
# (contracts/client-layout.json). The selector leaves both as written and the
# runner resolves them, so the ruleset hash does not depend on where anything
# is checked out.
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENT_ROOT = "qa-master"
RESERVED = ("engine", "client")
_LOCATED = re.compile(r"\$(engine|client)(?=/|$)")


# ── contracts ───────────────────────────────────────────────────────────────
# The three files the engine reads at run time, the profile, the catalog and
# the waivers, are checked against their contracts (contracts/*.schema.json)
# before anything is selected. The engine stays standard-library only, so the
# checks are written out here, and tests/test_contracts.py feeds every contract
# example to them so that the two cannot drift apart. A key enters a contract
# on the day something reads it (decision 004).
SEMVER = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")
DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
RULE_ID = re.compile(r"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+")
PRIMITIVE_NAME = re.compile(r"[a-z][a-z0-9_]*@[0-9]+")
REPO_PATH = re.compile(r"(?![/\\])(?!(.*/)?\.\.(/|$))[^\\]+")
PUBLIC_URL = re.compile(r"https://[^\s/?#]+[^\s]*")

# The profile: a pin, the dimensions dimensions.json names, and facts, the keys
# a rule reads that are not dimensions. client, repo, name and logs_customer_id
# are the client registry's and left the profile (decision 010).
PROFILE_FACTS = ("tenant_key", "schema_file", "migrations_dir", "public_url", "mapping_file")
REGISTRY_FIELDS = ("client", "repo", "name", "logs_customer_id")
CATALOG_FIELDS = ("catalog_version", "min_binary_version", "max_waiver_days", "rules")
RULE_FIELDS = ("id", "family", "primitive", "severity", "enforcement", "waivable",
               "applies_when", "params")
RULE_OPTIONAL = ("depends_on", "empty_population")
SEVERITIES = ("blocking", "advisory", "draft")
WAIVER_FIELDS = ("rule_id", "waives", "reason", "owner", "expires")
WAIVER_OPTIONAL = ("objects",)


def _is_date(value) -> bool:
    if not (isinstance(value, str) and DATE.fullmatch(value)):
        return False
    try:
        datetime.date.fromisoformat(value)
        return True
    except ValueError:
        return False


def _version(value: str) -> tuple:
    return tuple(int(x) for x in value.split("."))


def _whole(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def validate_profile(profile: dict, dimensions: dict) -> list[str]:
    """A value outside the closed vocabulary rejects the profile.

    The alternative is a project that quietly receives the wrong rule set, which
    is the class this whole product exists to prevent. Only the dimensions some
    rule actually filters on are enforced; closing a vocabulary no rule reads
    would be a guess that later needs undoing.

    The rest is the profile contract: the pin a client runs, no field nobody
    reads, the tenant key wherever tenancy is a column, and paths that stay
    inside the repository.

    The message names the allowed values and the way out. A gate that blocks
    without showing the exit gets worked around."""
    if not isinstance(profile, dict):
        return ["the profile is not a JSON object"]
    problems = []
    pin = profile.get("catalog_pin")
    if pin is None:
        problems.append("profile.catalog_pin is missing · the catalog release this "
                        "project runs, such as 0.2.0")
    elif not (isinstance(pin, str) and SEMVER.fullmatch(pin)):
        problems.append(f"profile.catalog_pin = {pin!r} is not a release such as 0.2.0")
    enforced = dimensions.get("enforced", {})
    recorded = dimensions.get("recorded_not_enforced", [])
    defaults = dimensions.get("defaults", {})
    for dim, allowed in enforced.items():
        if dim not in profile:
            if dim not in defaults:
                problems.append(f"profile.{dim} is missing · allowed: " + " · ".join(allowed))
        elif profile[dim] not in allowed:
            problems.append(
                f"profile.{dim} = {profile[dim]!r} is not a known value\n"
                f"    allowed: " + " · ".join(allowed) + "\n"
                f"    to add one: open a PR on dimensions.json")
    for dim in recorded:
        if dim in profile and not isinstance(profile[dim], str):
            problems.append(f"profile.{dim} = {profile[dim]!r} is not a string")
    known = {"catalog_pin", *enforced, *recorded, *PROFILE_FACTS}
    for key in profile:
        if key.startswith("$") or key in known:
            continue
        if key in REGISTRY_FIELDS:
            problems.append(f"profile.{key} is a field of the client registry, not of the "
                            f"profile (decision 010) · remove it here")
        else:
            problems.append(f"profile.{key} is not a profile field · a field enters the "
                            f"profile with the first rule that reads it (decision 004)")
    tenant = profile.get("tenant_key")
    if "tenant_key" in profile and not (isinstance(tenant, str) and tenant):
        problems.append("profile.tenant_key is empty")
    elif profile.get("multi_tenancy") == "column" and "tenant_key" not in profile:
        problems.append("profile.tenant_key is missing · multi_tenancy is column, so the "
                        "isolation rules need the column that carries the tenant")
    for key in ("schema_file", "migrations_dir", "mapping_file"):
        if key in profile and not (isinstance(profile[key], str)
                                   and REPO_PATH.fullmatch(profile[key])):
            problems.append(f"profile.{key} = {profile[key]!r} is not a path in the "
                            f"repository: relative, with no '..' and no backslash")
    if "public_url" in profile and not (isinstance(profile["public_url"], str)
                                        and PUBLIC_URL.fullmatch(profile["public_url"])):
        problems.append(f"profile.public_url = {profile['public_url']!r} is not an https url")
    return problems


def with_defaults(profile: dict, dimensions: dict) -> dict:
    """The profile as the engine reads it: an enforced dimension it leaves out
    takes the vocabulary's default (dimensions.json). schema_source entered in
    0.2.2, and every rule before it assumed a schema file, so a profile that
    does not say is read as schema_file. Said or not, the same profile selects
    the same rules under the same hash."""
    missing = {d: v for d, v in dimensions.get("defaults", {}).items() if d not in profile}
    return {**profile, **missing}


def validate_catalog(catalog: dict, dimensions: dict) -> list[str]:
    """The catalog against its contract, cross-checks 3 and 6 included, and
    what only the engine can say: whether it has every primitive the catalog
    names, and whether it is new enough to run it.

    Each of these selected or ran rules silently wrong when let through: a
    severity outside the three is neither blocking nor advisory, a filter on a
    dimension nobody enforces de-selects the rule on a typo, a cycle in
    depends_on leaves both rules waiting for each other, and a literal
    qa-master/ path points at a folder the client may not have."""
    if not isinstance(catalog, dict):
        return ["the catalog is not a JSON object"]
    problems = [f"catalog.{k} is missing" for k in CATALOG_FIELDS if k not in catalog]
    problems += [f"catalog.{k} is not a catalog field" for k in catalog
                 if not k.startswith("$") and k not in CATALOG_FIELDS]
    for k in ("catalog_version", "min_binary_version"):
        if k in catalog and not (isinstance(catalog[k], str) and SEMVER.fullmatch(catalog[k])):
            problems.append(f"catalog.{k} = {catalog[k]!r} is not a release such as 0.2.0")
        elif k == "min_binary_version" and k in catalog \
                and _version(catalog[k]) > _version(BINARY_VERSION):
            problems.append(f"the catalog needs engine {catalog[k]} or later; this one "
                            f"is {BINARY_VERSION}")
    if "max_waiver_days" in catalog and not (_whole(catalog["max_waiver_days"])
                                             and 1 <= catalog["max_waiver_days"] <= 365):
        problems.append("catalog.max_waiver_days is not a whole number of days from 1 to 365")
    rules = catalog.get("rules", [])
    if not isinstance(rules, list):
        return problems + ["catalog.rules is not a list"]
    enforced, ids, deps = set(dimensions.get("enforced", {})), set(), {}
    for i, rule in enumerate(rules):
        if not isinstance(rule, dict):
            problems.append(f"rules[{i}] is not an object")
            continue
        rid = rule.get("id")
        where = f"rule {rid}" if isinstance(rid, str) else f"rules[{i}]"
        problems += [f"{where}: {k} is missing" for k in RULE_FIELDS if k not in rule]
        problems += [f"{where}: {k} is not a rule field" for k in rule
                     if not k.startswith("$") and k not in RULE_FIELDS + RULE_OPTIONAL]
        if "id" in rule:
            if not (isinstance(rid, str) and RULE_ID.fullmatch(rid)):
                problems.append(f"{where}: id {rid!r} is not a rule id, such as repo.schema_file_present")
            elif rid in ids:
                problems.append(f"{where}: the id appears twice")
            else:
                ids.add(rid)
        if "family" in rule and not (_whole(rule["family"]) and 0 <= rule["family"] <= 6):
            problems.append(f"{where}: family {rule['family']!r} is not 0 to 6")
        prim = rule.get("primitive")
        if "primitive" in rule:
            if not (isinstance(prim, str) and PRIMITIVE_NAME.fullmatch(prim)):
                problems.append(f"{where}: primitive {prim!r} is not a primitive, such as file_exists@1")
            elif prim not in PRIMITIVES:
                problems.append(f"{where}: this engine ({BINARY_VERSION}) has no {prim}")
        if "severity" in rule and rule["severity"] not in SEVERITIES:
            problems.append(f"{where}: severity {rule['severity']!r} is not blocking, "
                            f"advisory or draft")
        if "enforcement" in rule and rule["enforcement"] != "exit_code":
            problems.append(f"{where}: enforcement {rule['enforcement']!r} is not exit_code")
        if "waivable" in rule and not isinstance(rule["waivable"], bool):
            problems.append(f"{where}: waivable is not true or false")
        applies = rule.get("applies_when")
        if "applies_when" in rule and not isinstance(applies, dict):
            problems.append(f"{where}: applies_when is not an object")
        for key, allowed in (applies.items() if isinstance(applies, dict) else ()):
            if not (allowed == "*" or (isinstance(allowed, list) and allowed
                                       and all(isinstance(v, str) for v in allowed)
                                       and len(set(allowed)) == len(allowed))):
                problems.append(f"{where}: applies_when.{key} is neither \"*\" nor a list of values")
            if key not in enforced and key not in PROFILE_FACTS:
                problems.append(f"{where}: applies_when.{key} is neither an enforced dimension "
                                f"nor a profile fact, so a typo in its value would de-select "
                                f"the rule without a word (cross-check 3)")
        for e in _bootstrap_entries(rule.get("params")):
            problems += [f"{where}: {p}" for p in _bootstrap_line_problems(e, enforced)]
        if sum(1 for e in _bootstrap_entries(rule.get("params"))
               if isinstance(e, dict) and e.get("schema") is True) > 1:
            problems.append(f"{where}: bootstrap: more than one line is marked schema")
        if "params" in rule and not isinstance(rule["params"], dict):
            problems.append(f"{where}: params is not an object")
        elif _names_client_folder(rule.get("params")):
            problems.append(f"{where}: params name a literal qa-master/ path; a client file is "
                            f"$client/..., an engine file $engine/... (decision 006)")
        if isinstance(rid, str) and rid.startswith(SECRET_RULES) and prim == "shell@1":
            params = rule["params"] if isinstance(rule.get("params"), dict) else {}
            problems += [f"{where}: {p}" for p in _conceal_problems(params.get("conceal"))]
        depends = rule.get("depends_on")
        if "depends_on" in rule:
            if not (isinstance(depends, list) and len(set(map(str, depends))) == len(depends)
                    and all(isinstance(d, str) and RULE_ID.fullmatch(d) for d in depends)):
                problems.append(f"{where}: depends_on is not a list of rule ids")
            elif isinstance(rid, str):
                deps[rid] = depends
        if "empty_population" in rule:
            problems += [f"{where}: {p}" for p in _empty_population_problems(rule["empty_population"])]
    for rid, depends in deps.items():
        problems += [f"rule {rid}: depends_on {d}, which is not in the catalog (cross-check 3)"
                     for d in depends if d not in ids]
    problems += [f"rule {rid}: depends_on leads back to itself, so it would wait forever "
                 f"(cross-check 3)" for rid in sorted(_on_a_cycle(deps))]
    return problems


def _bootstrap_line_problems(e, enforced: set) -> list[str]:
    """A bootstrap line is a path or a glob, or {file, when?, optional?}. Its
    `when` is held to what applies_when is held to (cross-check 3): a
    condition on a dimension nobody enforces would drop the line on a typo."""
    if isinstance(e, str):
        return []
    if not isinstance(e, dict):
        return ["a bootstrap line is neither a path nor an object"]
    out = [f"bootstrap: {k} is not a field of a bootstrap line" for k in e
           if not str(k).startswith("$") and k not in ("file", "when", "optional", "schema")]
    if not isinstance(e.get("file"), str) or not e.get("file"):
        out.append("bootstrap: a line has no file")
    for k in ("optional", "schema"):
        if k in e and not isinstance(e[k], bool):
            out.append(f"bootstrap: {k} is not true or false")
    # the lines after it may say "already exists": only under schema_file,
    # where the migrations are applied over a schema file (catalog 0.2.2)
    if e.get("schema") is True and e.get("when") != {"schema_source": ["schema_file"]}:
        out.append("bootstrap: a line marked schema loads only when schema_source is schema_file")
    when = e.get("when", {})
    if not isinstance(when, dict):
        return out + ["bootstrap: when is not an object"]
    for dim, allowed in when.items():
        if dim not in enforced:
            out.append(f"bootstrap: when.{dim} is not an enforced dimension, so a typo in its "
                       f"value would drop the line without a word (cross-check 3)")
        if not (isinstance(allowed, list) and allowed and all(isinstance(v, str) for v in allowed)):
            out.append(f"bootstrap: when.{dim} is not a list of values")
    return out


def _names_client_folder(value) -> bool:
    """A literal path into the client folder (cross-check 6)."""
    if isinstance(value, str):
        return re.match(r"(\./)?qa-master/", value) is not None
    if isinstance(value, list):
        return any(_names_client_folder(v) for v in value)
    if isinstance(value, dict):
        return any(_names_client_folder(v) for v in value.values())
    return False


def _on_a_cycle(deps: dict) -> set:
    on_cycle = set()
    for start in deps:
        stack, seen = list(deps.get(start, [])), set()
        while stack:
            n = stack.pop()
            if n == start:
                on_cycle.add(start)
                break
            if n not in seen:
                seen.add(n)
                stack += deps.get(n, [])
    return on_cycle


def _empty_population_problems(ep) -> list[str]:
    if not isinstance(ep, dict):
        return ["empty_population is not an object"]
    out = [f"empty_population.{k} is not a field of it" for k in ep
           if not k.startswith("$") and k not in ("allowed", "reason", "expires")]
    if ep.get("allowed") is not True:
        out.append("empty_population.allowed is not true")
    if not (isinstance(ep.get("reason"), str) and len(ep["reason"]) >= 10):
        out.append("empty_population.reason says too little: 10 characters at least")
    if not _is_date(ep.get("expires")):
        out.append("empty_population.expires is not a date, YYYY-MM-DD")
    return out


# ── selector ────────────────────────────────────────────────────────────────
def select(profile: dict, catalog: dict) -> dict:
    """profile + catalog -> ruleset. Pure and total: every rule is either
    selected or rejected with a stated reason."""
    selected, rejected = [], []
    for rule in catalog["rules"]:
        applies = rule.get("applies_when") or {}
        why = None
        for dim, allowed in applies.items():
            have = profile.get(dim)
            # "*" means the dimension only has to be present. without it, a rule
            # whose params expand $public_url was selected for a profile with no
            # such field, and the smoke check would have run against the literal
            # string "$public_url".
            if allowed == "*":
                if not have:
                    why = f"profile.{dim} is not set"
                    break
            elif have not in allowed:
                why = f"profile.{dim} = {have!r} not in {allowed}"
                break
        # A shell command must be literal in the catalog. Checking the expanded
        # string for a `$` was exactly backwards — after substitution there is
        # no `$` left, and a profile carrying `x; touch /tmp/pwned` ran and
        # created the file. The only moment this is visible is before expansion.
        raw = rule.get("params") or {}
        shell_interp = [k for k in SHELL_PARAMS
                        if isinstance(raw.get(k), str) and "$" in raw[k]]
        if shell_interp and not why:
            why = (f"params {shell_interp} interpolate a profile value into a "
                   f"shell command. a profile is written per client, so this is "
                   f"arbitrary code execution. shell commands must be literal.")
        # A draft is a rule on trial: it runs against qa-master's own fixtures,
        # never for a client, so it never reaches a lock (contracts-spec §2.4).
        if rule.get("severity") == "draft" and not why:
            why = "severity draft: a rule on trial runs against qa-master's fixtures, never for a client"
        # A bootstrap line that depends on a dimension the profile does not
        # have would be dropped or kept on a guess. It is said instead.
        unset = sorted({d for e in _bootstrap_entries(raw) if isinstance(e, dict)
                        for d in (e.get("when") or {}) if d not in profile})
        if unset and not why:
            why = (f"a bootstrap line depends on profile.{', profile.'.join(unset)}, "
                   f"which is not set")

        if why:
            rejected.append({"rule_id": rule["id"], "reason": why})
        else:
            selected.append({
                "rule_id":   rule["id"],
                "family":    rule["family"],
                "primitive": rule["primitive"],
                "severity":  rule["severity"],
                "waivable":  rule.get("waivable", True),
                "params":    _expand(_choose_bootstrap(rule.get("params", {}), profile), profile),
                # Carried through so the runner can see it. The selector built
                # an explicit dict and silently dropped anything not listed
                # here, so declaring depends_on in the catalog had no effect at
                # all — the rule ran anyway and reported a fail nobody could
                # distinguish from a real one.
                "depends_on": rule.get("depends_on", []),
            })
            if rule.get("empty_population"):
                selected[-1]["empty_population"] = rule["empty_population"]
    canonical = canonical_json(
        {"profile": _canonical(profile, catalog),
         "catalog_version": catalog["catalog_version"],
         "rules": sorted(({"id": r["rule_id"], "primitive": r["primitive"],
                           "params": r["params"]} for r in selected),
                         key=lambda r: r["id"])})
    return {"ruleset_hash": hashlib.sha256(canonical.encode()).hexdigest()[:16],
            "catalog_version": catalog["catalog_version"],
            "binary_version": BINARY_VERSION,
            "selected": selected, "rejected": rejected}


def canonical_json(obj) -> str:
    """The one serialisation every hash here is taken over (contracts-spec
    §0.6): `$` keys dropped at any depth, since they are notes for people, then
    sorted keys, no whitespace, UTF-8. The ruleset hash has always been taken
    this way; the lock's hashes reuse it rather than inventing a second."""
    def strip(v):
        if isinstance(v, dict):
            return {k: strip(x) for k, x in v.items() if not str(k).startswith("$")}
        if isinstance(v, list):
            return [strip(x) for x in v]
        return v
    return json.dumps(strip(obj), sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def canonical_hash(obj) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def _canonical(profile: dict, catalog: dict) -> dict:
    """Only what can change the selection enters the hash.

    A first version took every field that was not a comment, so recording
    `team_size` — which no rule reads — moved the hash and invalidated the
    agent layer for nothing. The set is now derived from the catalog itself:
    the dimensions some rule filters on, plus any dimension a param expands.
    """
    used = set()
    for rule in catalog["rules"]:
        used |= set((rule.get("applies_when") or {}).keys())
        for v in json.dumps(rule.get("params", {}), ensure_ascii=False).split("$")[1:]:
            for dim in profile:
                if dim not in RESERVED and v.startswith(dim):
                    used.add(dim); break
    return {k: profile[k] for k in sorted(used) if k in profile}


def _bootstrap_entries(params) -> list:
    boot = params.get("bootstrap") if isinstance(params, dict) else None
    return boot if isinstance(boot, list) else []


def _choose_bootstrap(params: dict, profile: dict) -> dict:
    """The bootstrap lines this profile builds from (catalog 0.2.2).

    A line is a path or a glob, or an object: `file`, the path or glob;
    `when`, the dimensions it depends on, matched as applies_when matches; and
    `optional`, true when a project may have nothing there; `schema`, true on
    the schema file's line, whose objects the lines after it may find already
    there. A line whose `when` does not hold is not part of this project's
    database: with schema_source migrations_only the migrations are the
    schema, and a schema file beside them is not loaded. What is kept reaches
    the runner without `when`."""
    boot = _bootstrap_entries(params)
    if not boot:
        return params
    kept = []
    for e in boot:
        if not isinstance(e, dict):
            kept.append(e)
            continue
        if all(profile.get(d) in allowed for d, allowed in (e.get("when") or {}).items()):
            marks = {k: True for k in ("optional", "schema") if e.get(k) is True}
            kept.append({"file": e["file"], **marks} if marks else e["file"])
    return {**params, "bootstrap": kept}


def _expand(value, profile: dict):
    """Substitutes $dimension anywhere in the params, at any depth.

    A first version walked only the top level and only strings, so a
    `bootstrap: [..., "$schema_file", ...]` list passed through untouched and
    the rules ran against a database nobody had built. A substitution that
    silently does nothing is worse than one that fails.

    `$engine` and `$client` are left for the runner, even if a profile carries
    a key of that name: a profile that said `client: x` would otherwise move
    every client file the catalog names to x/."""
    if isinstance(value, str):
        for dim, val in sorted(profile.items(), key=lambda kv: -len(kv[0])):
            if dim in RESERVED:
                continue
            value = value.replace(f"${dim}", str(val))
        return value
    if isinstance(value, list):
        return [_expand(v, profile) for v in value]
    if isinstance(value, dict):
        return {k: _expand(v, profile) for k, v in value.items()}
    return value


def _locate(value):
    """Resolves `$engine` and `$client` in params, at any depth, for the run.

    `$client` stays relative, because every primitive joins its paths with the
    repository it was handed. `$engine` becomes this file's own folder, which
    an absolute path keeps whole through that join."""
    if isinstance(value, str):
        return _LOCATED.sub(lambda m: ENGINE_DIR if m.group(1) == "engine" else CLIENT_ROOT,
                            value)
    if isinstance(value, list):
        return [_locate(v) for v in value]
    if isinstance(value, dict):
        return {k: _locate(v) for k, v in value.items()}
    return value


def _empty_population_holds(rule: dict, today) -> bool:
    """A rule may declare that finding nothing is acceptable, with a reason and
    a date (decision 014). Until that date its `vacuous` is reported and does
    not block. After it, it blocks like any other: an exception nobody renews
    is not one anybody is still making."""
    ep = rule.get("empty_population") or {}
    if ep.get("allowed") is not True:
        return False
    try:
        return today <= datetime.date.fromisoformat(str(ep.get("expires")))
    except ValueError:
        return False


def _boot_files(repo, boot):
    """A bootstrap entry is a path or a glob, expanded in sorted order.

    Without the glob, "apply every migration" could only be written as a list
    of files, and a migration added after the list would not be applied. That
    is the state this replaces: the rules ran against schema.sql alone, 32
    tables where the migrations build 70, and passed. A glob that matches
    nothing is returned as missing rather than skipped — an empty expansion
    would rebuild exactly that smaller database, silently.

    The same holds for a single file (catalog 0.2.2). Until then a file the
    repository lacks was handed to psql, which failed, and the build went on
    without it: a schema_file project without its schema file was built from
    the migrations alone, and answered about. An entry marked optional, such
    as the client's harness, may name nothing; then it adds nothing."""
    out, missing, _ = _boot_plan(repo, boot)
    return out, missing


def _boot_plan(repo, boot):
    """_boot_files, and the index in its list where the files after the schema
    file begin, or None when no line is marked schema."""
    out, missing, after_schema = [], [], None
    for b in boot:
        optional = isinstance(b, dict) and b.get("optional") is True
        path = b["file"] if isinstance(b, dict) else b
        full = os.path.join(repo, path)
        if any(ch in path for ch in "*?["):
            hits = sorted(glob.glob(full))
            out += hits
            if not hits and not optional:
                missing.append(path)
        elif os.path.isfile(full):
            out.append(full)
        elif not optional:
            missing.append(path)
        if isinstance(b, dict) and b.get("schema") is True:
            after_schema = len(out)
    return out, missing, after_schema


_ALREADY_EXISTS = re.compile(r'(\w+) ".*\balready exists\b')
_PSQL_AT = re.compile(r"psql:.*?:(\d+):\s*ERROR:")


def _load_bootstrap(url: str, repo: str, files: list, after_schema=None):
    """Applies each bootstrap file to its end, as the build always has, and
    reads what psql printed. Returns (failed, tolerated).

    A file psql could not run, or one that printed an SQL error, is a line that
    did not load: the build stops there, and `failed` names the file, the line
    and the error, its literals concealed. A rule must not answer about a
    database that was not built (catalog 0.2.2).

    One error is not a failure, in one place. Under schema_source schema_file
    the files after the schema file (from index `after_schema`) are applied
    over a schema that already created much of what they create, so an
    "already exists" there is that overlap. It is counted, by file and by
    kind, in `tolerated`, which goes into the rule's evidence: not swallowed.
    Whether the schema file and the migrations agree is
    schema.matches_migrations' question."""
    tolerated, total = {}, 0
    for i, f in enumerate(files):
        shown = _shown(f, repo)
        p = subprocess.run(["psql", url, "-qX", "-f", f], capture_output=True, text=True)
        if p.returncode != 0:
            err = next((l for l in (p.stderr or "").splitlines() if l.strip()), "psql failed")
            return {"reason": f"bootstrap: {shown} did not load", "file": shown, "line": None,
                    "error": _mask_literals(err)[:160]}, None
        may_exist = after_schema is not None and i >= after_schema
        kinds = {}
        # One file per psql run, so every ERROR it printed is this line's,
        # whatever psql called the file (it prints ./db/x.sql as db/x.sql).
        # None is passed over: an error not read would pass for a clean build.
        for err in (l for l in (p.stderr or "").splitlines() if "ERROR:" in l):
            where = _PSQL_AT.match(err)
            msg = err.split("ERROR:", 1)[1].strip()
            kind = _ALREADY_EXISTS.match(msg)
            if may_exist and kind:
                kinds[kind.group(1)] = kinds.get(kind.group(1), 0) + 1
                continue
            return {"reason": f"bootstrap: {shown} did not load", "file": shown,
                    "line": int(where.group(1)) if where else None,
                    "error": _mask_literals("ERROR:  " + msg)[:160]}, None
        if kinds:
            n = sum(kinds.values())
            tolerated[shown] = {"already_exists": n, "by_kind": dict(sorted(kinds.items()))}
            total += n
    return None, ({"already_exists": total, "files": tolerated} if tolerated else None)


def _shown(path: str, repo: str) -> str:
    rel = os.path.relpath(path, repo)
    return (path if rel.startswith("..") else rel).replace(os.sep, "/")


# ── primitives ──────────────────────────────────────────────────────────────
# Every primitive returns (outcome, examined, evidence). `examined` is not
# optional: a primitive that cannot say how many units it looked at cannot be
# trusted to say it found nothing.
class Ctx:
    def __init__(self, repo: str, db: str | None):
        self.repo, self.db = repo, db

    def psql(self, sql: str, stop_on_error=True):
        if not self.db:
            return None, "no database url"
        cmd = ["psql", self.db, "-tAqX"]
        if stop_on_error:
            cmd += ["-v", "ON_ERROR_STOP=1"]
        cmd += ["-c", sql]
        p = subprocess.run(cmd, capture_output=True, text=True)
        return p, None

    def scratch_db(self, tag: str):
        """A database of its own, dropped afterwards. Reserved words are a
        real hazard here: a database called `full` fails to create."""
        if not self.db:
            return None, lambda: None
        name = f"qam_{tag}_{os.getpid()}"
        # only the path segment may be rewritten. a first version used a regex
        # over the whole url and rewrote `?host=/tmp` as well, which pointed
        # the socket directory at a database name.
        from urllib.parse import urlsplit, urlunsplit
        parts = urlsplit(self.db)
        admin = urlunsplit(parts._replace(path="/postgres"))
        r = subprocess.run(["psql", admin, "-qX", "-c", f'create database "{name}"'],
                           capture_output=True, text=True)
        if r.returncode != 0:
            return None, lambda: None
        url = urlunsplit(parts._replace(path=f"/{name}"))
        def drop():
            subprocess.run(["psql", admin, "-qX", "-c", f'drop database if exists "{name}"'],
                           capture_output=True, text=True)
        return url, drop

    def psql_file(self, path: str, stop_on_error=True):
        if not self.db:
            return None, "no database url"
        cmd = ["psql", self.db, "-qX"]
        if stop_on_error:
            cmd += ["-v", "ON_ERROR_STOP=1"]
        cmd += ["-f", path]
        p = subprocess.run(cmd, capture_output=True, text=True)
        return p, None


def prim_file_exists(ctx, params):
    p = os.path.join(ctx.repo, params["path"])
    ok = os.path.isfile(p)
    return (PASS if ok else FAIL), 1, {"path": params["path"], "exists": ok}


def prim_file_absent(ctx, params):
    p = os.path.join(ctx.repo, params["path"])
    ok = not os.path.exists(p)
    return (PASS if ok else FAIL), 1, {"path": params["path"], "absent": ok}


def prim_glob_nonempty(ctx, params):
    hits = glob.glob(os.path.join(ctx.repo, params["glob"]))
    return (PASS if hits else FAIL), len(hits), {"glob": params["glob"], "matched": len(hits)}


# ── secrets: where, never what ─────────────────────────────────────────────
# A rule that finds a secret must not be what publishes it. Evidence travels in
# report/1: into CI artifacts, the ingest request and the run the server keeps.
# Until 0.2.1 the rule for a literal password in SQL copied grep's line there,
# and a client's first run on 0.2.0 sent its password. Now the evidence of every
# secrets.* rule says where: per finding the file, the line, the rule, and the
# first four hex characters of the value's sha256. That tells two findings
# apart and shows one value in two places, and is no part of the value.
SECRET_RULES = "secrets."
SECRET_EVIDENCE = ("findings", "findings_truncated", "violations", "offending",
                   "roles_found", "commits", "reason", "cmd")
FINDING_FIELDS = ("file", "line", "commit", "value_sha256")


def _fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:4]


def _conceal(rule_id: str, evidence: dict) -> dict:
    """The evidence of a secrets rule, cut to what it may carry. The runner does
    this, not each primitive, so a secrets rule cannot publish what it finds by
    returning a line of output or a stderr: those are dropped, and their keys
    named under `concealed`."""
    kept = {k: v for k, v in evidence.items() if k in SECRET_EVIDENCE}
    if isinstance(kept.get("findings"), list):
        kept["findings"] = [{**{k: f[k] for k in FINDING_FIELDS if k in f}, "rule": rule_id}
                            for f in kept["findings"] if isinstance(f, dict)]
    dropped = sorted(k for k in evidence if k not in SECRET_EVIDENCE)
    if dropped:
        kept["concealed"] = dropped
    return kept


def _conceal_problems(conceal) -> list[str]:
    """shell@1 returns what its command prints, and on a secrets rule that is the
    secret. `conceal` names the value in each printed line: a regex whose one
    group is the value."""
    why = ("a secrets rule on shell@1 declares params.conceal, a regex whose one group is "
           "the value, so its evidence says where and never what")
    if not isinstance(conceal, str):
        return [f"conceal is missing: {why}"]
    try:
        groups = re.compile(conceal).groups
    except re.error as e:
        return [f"conceal is not a regex ({e})"]
    return [] if groups == 1 else [f"conceal has {groups} groups, not one: {why}"]


# A net under every rule, secrets.* or not: any string in the evidence, or in
# what render() prints, that matches the patterns of contracts-spec §0.8 leaves
# as its fingerprint, the way a secrets finding does, and the field is named
# under `concealed`. These are the patterns contracts/validate.py holds, each
# carried to the end of the secret so that all of it is concealed; the engine
# travels to clients alone, so it keeps its own copy, and
# tests/test_secret_evidence.py keeps the copy in step.
SECRET_SPANS = (
    re.compile(r"(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
    re.compile(r"(?<![A-Za-z0-9])(?:sk_|sb_secret_|ghp_|github_pat_)[A-Za-z0-9_-]*"),
    re.compile(r"-----BEGIN[\s\S]*?(?:-----END[^\n]*?-----|\Z)"),
)
LONG_TOKEN = re.compile(r"[A-Za-z0-9+/=_-]{40,}")


def _scrub(text: str):
    """(text with every §0.8 secret replaced by <secret sha256:XXXX>, whether
    there was one). A long token is one only with an upper-case letter and a
    digit in it, as in §0.8, so a hex hash or a path is left alone."""
    def mask(m):
        return f"<secret sha256:{_fingerprint(m[0])}>"
    out = text
    for pattern in SECRET_SPANS:
        out = pattern.sub(mask, out)
    out = LONG_TOKEN.sub(lambda m: mask(m) if re.search(r"[A-Z]", m[0]) and re.search(r"[0-9]", m[0])
                         else m[0], out)
    return out, out != text


def _scrub_evidence(value, path: str, hidden: list):
    """Every string in the evidence, at any depth, through _scrub. The path of
    each one that changed is appended to `hidden`."""
    if isinstance(value, str):
        out, changed = _scrub(value)
        if changed:
            hidden.append(path)
        return out
    if isinstance(value, list):
        return [_scrub_evidence(v, f"{path}[{i}]", hidden) for i, v in enumerate(value)]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            key = _scrub_evidence(k, f"{path}.{k}" if path else str(k), hidden) if isinstance(k, str) else k
            out[key] = _scrub_evidence(v, f"{path}.{key}" if path else str(key), hidden)
        return out
    return value


def _net(evidence: dict) -> dict:
    hidden = []
    evidence = _scrub_evidence(evidence, "", hidden)
    if hidden:
        evidence["concealed"] = sorted(set(evidence.get("concealed", [])) | set(hidden))
    return evidence


_QUOTED = re.compile(r"\"([^\"\n]*)\"|'([^'\n]*)'")


def _mask_literals(line: str) -> str:
    """A line psql or a project's suite printed, with every literal between
    quotes, double or single, replaced by <literal sha256:XXXX len:N>. psql
    quotes the value it rejected ("invalid input syntax for type uuid: ..."), so
    without this a value from the client's SQL leaves in the evidence. The
    error and where it happened stay. Identifiers psql quotes go too: a quote
    cannot say which it holds."""
    def mask(m):
        value = m[1] if m[1] is not None else m[2]
        return f"<literal sha256:{_fingerprint(value)} len:{len(value)}>"
    return _QUOTED.sub(mask, line)


_GREP_LINE = re.compile(r"(.*?):(\d+):(.*)")


def _grep_findings(output: str, pattern) -> list:
    """`grep -n` lines -> findings, keeping no text of any line. Each value the
    pattern's group matches is one finding; a line it does not match, or one
    that is not grep's, still counts, without a fingerprint."""
    findings = []
    for ln in output.splitlines():
        if not ln.strip():
            continue
        m = _GREP_LINE.fullmatch(ln)
        if not m:
            findings.append({"file": None, "line": None, "value_sha256": None})
            continue
        path = m[1][2:] if m[1].startswith("./") else m[1]
        for value in pattern.findall(m[3]) or [None]:
            findings.append({"file": path, "line": int(m[2]),
                             "value_sha256": None if value is None else _fingerprint(value)})
    return findings


_HUNK = re.compile(r"@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def _log_hits(log: str, pattern):
    """(commit, file, line, match) for every match of pattern in `git log -p`.

    A match in a diff line has its file, and its line in that commit's version
    of the file (for a removed line, the version before). One in a commit
    message or a header has neither. Every line is searched, so this finds what
    a search of the whole output finds."""
    commit = path = old_path = None
    mode, old, new = "message", 0, 0
    for ln in log.split("\n"):
        line = None
        hunk = _HUNK.match(ln) if mode in ("header", "hunk") else None
        if ln.startswith("commit "):
            commit, path, mode = (ln.split() + [None])[1], None, "message"
        elif ln.startswith("diff --git "):
            path, old_path, mode = None, None, "header"
        elif mode == "header" and ln.startswith("--- "):
            old_path = ln[6:] if ln.startswith("--- a/") else None
        elif mode == "header" and ln.startswith("+++ "):
            path = ln[6:] if ln.startswith("+++ b/") else old_path
        elif hunk:
            old, new, mode = int(hunk[1]), int(hunk[2]), "hunk"
        elif mode == "hunk" and ln[:1] == "-":
            line, old = old, old + 1
        elif mode == "hunk" and ln[:1] == "+":
            line, new = new, new + 1
        elif mode == "hunk" and ln[:1] == " ":
            line, old, new = new, old + 1, new + 1
        for match in pattern.findall(ln):
            yield (commit[:12] if commit else None), (path if line is not None else None), line, match


SHELL_PARAMS = ("cmd", "population_cmd")


def prim_shell(ctx, params):
    p = subprocess.run(params["cmd"], shell=True, cwd=ctx.repo,
                       capture_output=True, text=True)
    got = (p.stdout or "").strip()
    pop = 0
    if params.get("population_cmd"):
        q = subprocess.run(params["population_cmd"], shell=True, cwd=ctx.repo,
                           capture_output=True, text=True)
        try:
            pop = int((q.stdout or "0").strip() or 0)
        except ValueError:
            pop = 0
    if pop == 0:
        return VACUOUS, 0, {"cmd": params["cmd"], "reason": "population is empty"}
    want = str(params.get("expect_stdout", "")).strip()
    outcome = PASS if got == want else FAIL
    if params.get("conceal"):
        # What the command printed is what it found, and on a secrets rule that
        # is the secret: only where it is leaves this function.
        found = _grep_findings(got, re.compile(params["conceal"])) if outcome == FAIL else []
        evidence = {"findings": found[:OBJECTS_SHOWN], "violations": len(found)}
        if len(found) > OBJECTS_SHOWN:
            evidence["findings_truncated"] = True
        return outcome, pop, evidence
    return outcome, pop, {"got": got, "expected": want}


def prim_sql_file_clean(ctx, params):
    """The schema must build in a single pass with no error.

    It runs against a database this primitive creates and drops, never against
    the one it was handed. A first version reused the caller's database, and
    reported `already exists` from a previous run as a failure of the file —
    a primitive whose answer depends on what ran before it is not a gate.

    What it builds is the profile's schema_source (catalog 0.2.2), in `source`:
    the schema file in `file`, or, for migrations_only, every migration under
    `migrations` in name order, each once, the build stopping at the first
    error. A project whose migrations are its schema is asked the same
    question as one with a schema file: does it build a database in one pass."""
    source = params.get("source", "schema_file")
    if source == "migrations_only":
        folder = params.get("migrations") or ""
        files = sorted(glob.glob(os.path.join(ctx.repo, folder, "*.sql")))
        if not files:
            return VACUOUS, 0, {"reason": f"no migrations under {folder}"}
    elif source == "schema_file":
        path = os.path.join(ctx.repo, params["file"])
        if not os.path.isfile(path):
            return UNRUNNABLE, 0, {"reason": f"{params['file']} not found"}
        files = [path]
    else:
        return UNRUNNABLE, 0, {"reason": f"source {source!r} is neither schema_file nor migrations_only"}
    boot, missing = _boot_files(ctx.repo, [params["bootstrap"]] if params.get("bootstrap") else [])
    if missing:
        return UNRUNNABLE, 0, {"reason": f"bootstrap matches no file: {', '.join(missing)}"}
    scratch, drop = ctx.scratch_db("sqlclean")
    if scratch is None:
        return UNRUNNABLE, 0, {"reason": "could not create a scratch database"}
    failed_at = None
    try:
        failed, _ = _load_bootstrap(scratch, ctx.repo, boot)
        if failed:
            return UNRUNNABLE, 0, failed
        for f in files:
            p = subprocess.run(["psql", scratch, "-qX", "-v", "ON_ERROR_STOP=1", "-f", f],
                               capture_output=True, text=True)
            if p.returncode != 0:
                failed_at = f
                break
    finally:
        drop()
    errors = re.findall(r"^psql.*ERROR:.*$", p.stderr or "", re.M)
    lines = 0
    for f in files:
        with open(f, encoding="utf-8", errors="replace") as fh:
            lines += sum(1 for _ in fh)
    if lines == 0:
        return VACUOUS, 0, {"reason": "the file is empty"}
    evidence = {"errors": len(errors), "first": (_mask_literals(errors[0])[:160] if errors else None)}
    if source == "migrations_only":
        evidence["files"] = len(files)
        if failed_at:
            evidence["failed_at"] = os.path.relpath(failed_at, ctx.repo).replace(os.sep, "/")
    return (PASS if failed_at is None else FAIL), lines, evidence


def prim_sql_returns_no_rows(ctx, params):
    """A predicate that must return nothing, over a declared population, with a
    counterexample that proves it can fire.

    **Every primitive that touches a database builds its own and drops it.**
    An earlier version read whichever database it was handed, and since nothing
    had applied the schema to it, three rules reported `vacuous` over an empty
    database while the schema itself had just passed. The report was not wrong
    — it was answering a question about a database nobody had populated.
    """
    if not ctx.db:
        return UNRUNNABLE, 0, {"reason": "no database url"}
    boot = params.get("bootstrap") or []
    if not boot:
        return UNRUNNABLE, 0, {"reason": "the rule declares no bootstrap — "
                                         "it cannot say which database to ask"}
    files, missing, after_schema = _boot_plan(ctx.repo, boot)
    if missing:
        return UNRUNNABLE, 0, {"reason": f"bootstrap matches no file: {', '.join(missing)}"}
    scratch, drop = ctx.scratch_db("pred")
    if scratch is None:
        return UNRUNNABLE, 0, {"reason": "could not create a scratch database"}
    inner = Ctx(ctx.repo, scratch)
    try:
        failed, tolerated = _load_bootstrap(scratch, ctx.repo, files, after_schema)
        if failed:
            return UNRUNNABLE, 0, failed
        outcome, examined, evidence = _predicate_body(inner, params)
        if tolerated:
            evidence["bootstrap_tolerated"] = tolerated
        return outcome, examined, evidence
    finally:
        drop()


def _predicate_body(ctx, params):

    pop_sql = params.get("population")
    if not pop_sql:
        return UNRUNNABLE, 0, {"reason": "the rule declares no population"}
    p, _ = ctx.psql(f"select count(*) from ({pop_sql}) q")
    if not p or p.returncode != 0:
        return UNRUNNABLE, 0, {"reason": "population query failed",
                               "stderr": (p.stderr or "")[:160] if p else None}
    examined = int((p.stdout or "0").strip() or 0)
    if examined == 0:
        return VACUOUS, 0, {"reason": "the predicate examined 0 rows"}

    ce = params.get("counterexample")
    if not ce:
        return UNPROVABLE, examined, {"reason": "no counterexample — this rule was never seen to fail"}
    probe = (f"begin; {ce}; select count(*) from ({params['predicate']}) q; rollback;")
    p, _ = ctx.psql(probe)
    caught = 0
    if p and p.returncode == 0:
        nums = [int(x) for x in re.findall(r"^\d+$", p.stdout or "", re.M)]
        caught = nums[-1] if nums else 0
    if caught == 0:
        return UNPROVABLE, examined, {"reason": "the counterexample was not caught"}

    p, _ = ctx.psql(f"select count(*) from ({params['predicate']}) q")
    if not p or p.returncode != 0:
        return UNRUNNABLE, examined, {"reason": "predicate failed",
                                      "stderr": (p.stderr or "")[:160] if p else None}
    bad = int((p.stdout or "0").strip() or 0)
    if bad == 0:
        return PASS, examined, {"violations": 0, "examined": examined}
    # What it found, by the predicate's first column: a waiver scoped to named
    # objects covers a failure only when it names every one of them.
    p, _ = ctx.psql(f"select * from ({params['predicate']}) q limit {OBJECTS_SHOWN + 1}")
    rows = (p.stdout or "").splitlines() if p and p.returncode == 0 else []
    evidence = {"violations": bad, "examined": examined,
                "objects": sorted({r.split("|")[0] for r in rows[:OBJECTS_SHOWN]})}
    if len(rows) > OBJECTS_SHOWN:
        evidence["objects_truncated"] = True
    return FAIL, examined, evidence


OBJECTS_SHOWN = 100


def prim_sql_suite(ctx, params):
    """Runs a suite the project wrote, and maps its exit to the six outcomes.

    The suite is per-client configuration; this primitive is generic code. It
    reads the markers the suite emits rather than guessing from the exit code
    alone — `VACUOUS` and `UNPROVABLE` are not failures of the code under test,
    and reporting them as `fail` sends the wrong person to look.
    """
    path = os.path.join(ctx.repo, params["file"])
    if not os.path.isfile(path):
        return UNRUNNABLE, 0, {"reason": f"{params['file']} not found"}
    if not ctx.db:
        return UNRUNNABLE, 0, {"reason": "no database url"}
    files, missing, after_schema = _boot_plan(ctx.repo, params.get("bootstrap", []))
    if missing:
        return UNRUNNABLE, 0, {"reason": f"bootstrap matches no file: {', '.join(missing)}"}
    scratch, drop = ctx.scratch_db("suite")
    if scratch is None:
        return UNRUNNABLE, 0, {"reason": "could not create a scratch database"}
    try:
        failed, tolerated = _load_bootstrap(scratch, ctx.repo, files, after_schema)
        if failed:
            return UNRUNNABLE, 0, failed
        p = subprocess.run(["psql", scratch, "-qX", "-v", "ON_ERROR_STOP=1", "-f", path],
                           capture_output=True, text=True)
    finally:
        drop()
    outcome, examined, evidence = _suite_outcome(path, p)
    if tolerated:
        evidence["bootstrap_tolerated"] = tolerated
    return outcome, examined, evidence


def _suite_outcome(path, p):
    """What a suite's run means, by the markers it printed."""
    err = (p.stderr or "") + (p.stdout or "")
    # the suite counts its own assertions; a suite that asserts nothing is vacuous
    examined = len(re.findall(r"must_fail|must_pass|must_equal|must_be_empty|must_catch|raise exception",
                              open(path, encoding="utf-8", errors="replace").read()))
    if examined == 0:
        return VACUOUS, 0, {"reason": "the suite contains no assertions"}
    if "VACUOUS" in err:
        return VACUOUS, examined, {"reason": _first(err, "VACUOUS")}
    if "UNPROVABLE" in err:
        return UNPROVABLE, examined, {"reason": _first(err, "UNPROVABLE")}
    if p.returncode == 0:
        return PASS, examined, {"assertions": examined}
    if "FAIL " in err:
        return FAIL, examined, {"reason": _first(err, "FAIL ")}
    return UNRUNNABLE, examined, {"reason": _first(err, "ERROR:") or "the suite did not run"}


def _first(text: str, marker: str):
    # the suite is the client's code, and its lines can quote the client's
    # values: each literal leaves as its fingerprint (see _mask_literals)
    for line in text.splitlines():
        if marker in line:
            kept = line.split(marker, 1)[1].strip() if marker != "ERROR:" else line.strip()
            return _mask_literals(kept)[:140]
    return None


def prim_schema_equals_migrations(ctx, params):
    """schema.sql alone must produce the same database as schema.sql plus every
    migration.

    Advisory, and gated on the one-pass rule. Measured on the client: the same
    files give 27 policies when the schema runs once and 109 when it runs twice,
    because migrations that alter policies find a different starting state. Each
    build is itself deterministic, so the ambiguity is in the definition of "the
    full build" — and a rule that measures its own harness is not a gate.

    It therefore reports UNPROVABLE while the schema needs two passes, and only
    compares once one pass is clean."""
    if not ctx.db:
        return UNRUNNABLE, 0, {"reason": "no database url"}
    schema = os.path.join(ctx.repo, params["schema"])
    if not os.path.isfile(schema):
        return UNRUNNABLE, 0, {"reason": f"{params['schema']} not found"}
    migr = sorted(glob.glob(os.path.join(ctx.repo, params["migrations"], "*.sql")))
    if not migr:
        return VACUOUS, 0, {"reason": "no migrations to compare against"}
    boot, missing = _boot_files(ctx.repo, params.get("bootstrap", []))
    if missing:
        return UNRUNNABLE, 0, {"reason": f"bootstrap matches no file: {', '.join(missing)}"}
    boot_failed = []

    def build(tag, with_migrations):
        url, drop = ctx.scratch_db(tag)
        if url is None:
            return None, None, lambda: None
        failed, _ = _load_bootstrap(url, ctx.repo, boot)
        if failed:
            boot_failed.append(failed)
            return url, 1, drop
        r = subprocess.run(["psql", url, "-qX", "-v", "ON_ERROR_STOP=1", "-f", schema],
                           capture_output=True, text=True)
        if with_migrations:
            for m in migr:
                subprocess.run(["psql", url, "-qX", "-f", m], capture_output=True, text=True)
        return url, r.returncode, drop

    a_url, one_pass_rc, a_drop = build("schonly", False)
    if a_url is None:
        return UNRUNNABLE, 0, {"reason": "could not create a scratch database"}
    try:
        if boot_failed:
            return UNRUNNABLE, 0, boot_failed[0]
        if one_pass_rc != 0:
            return UNPROVABLE, 0, {
                "reason": "schema.sql does not apply in one pass, so 'the full "
                          "build' has no single meaning — see schema.runnable_in_one_pass"}
        b_url, _, b_drop = build("schmigr", True)
        if b_url is None:
            return UNRUNNABLE, 0, {"reason": "could not create the comparison database"}
        try:
            sig = ("select string_agg(x, chr(10) order by x) from ("
                   "select 't:'||tablename from pg_tables where schemaname='public' "
                   "union all select 'v:'||viewname from pg_views where schemaname='public' "
                   "union all select 'p:'||tablename||'.'||policyname from pg_policies "
                   "where schemaname='public') q(x)")
            out = []
            for u in (a_url, b_url):
                r = subprocess.run(["psql", u, "-tAqX", "-c", sig], capture_output=True, text=True)
                out.append((r.stdout or "").strip().splitlines())
            only_full = sorted(set(out[1]) - set(out[0]))
            examined = len(out[1])
            if examined == 0:
                return VACUOUS, 0, {"reason": "the full build produced no objects"}
            if only_full:
                return FAIL, examined, {"missing_from_schema": len(only_full),
                                        "examples": only_full[:6]}
            return PASS, examined, {"objects": examined}
        finally:
            b_drop()
    finally:
        a_drop()


def prim_http_smoke(ctx, params):
    """Family 5: the product that is running.

    It asks the cheapest question there is — does the address answer, and does
    the answer not contain an error string. It proves nothing about whether the
    numbers on the page are right; that is family 6, which is not built.

    No network is a refusal, not a pass. A smoke check that cannot reach the
    address has not found the site healthy."""
    import urllib.request, urllib.error
    url = params.get("url")
    if not url:
        return UNRUNNABLE, 0, {"reason": "the rule declares no url"}
    must_not = params.get("must_not_contain", [])
    must     = params.get("must_contain", [])
    timeout  = float(params.get("timeout_s", 10))
    req = urllib.request.Request(url, headers={"User-Agent": "qa-master/smoke"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status = r.status
            body = r.read(200_000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        status, body = e.code, ""
    except Exception as e:
        return UNRUNNABLE, 0, {"reason": f"{type(e).__name__}: {e}", "url": url}

    checks = 1 + len(must) + len(must_not)
    if status >= 400:
        return FAIL, checks, {"status": status, "url": url}
    hit = [m for m in must_not if m.lower() in body.lower()]
    if hit:
        return FAIL, checks, {"status": status, "found_error_string": hit[:3]}
    missing = [m for m in must if m.lower() not in body.lower()]
    if missing:
        return FAIL, checks, {"status": status, "missing": missing[:3]}
    if not body.strip():
        return VACUOUS, checks, {"status": status, "reason": "the response body is empty"}
    return PASS, checks, {"status": status, "bytes": len(body)}


def prim_no_service_jwt(ctx, params):
    """Finds every JWT in the history and decodes it, failing only on
    role=service_role.

    Regular expressions cannot do this. A Supabase JWT carries its role inside a
    base64 payload whose offsets shift with every field before it, so no pattern
    separates an anon key from a service key — two attempts at one matched both
    or neither. gitleaks is left the formats that are unambiguous on sight; this
    takes the one that needs decoding.

    The anon key is publishable by design and ships in the browser bundle.
    Failing on it would fail every Supabase project forever."""
    import base64, json as _json
    p = subprocess.run("git log -p --all -- .", shell=True, cwd=ctx.repo,
                       capture_output=True, text=True)
    if p.returncode != 0:
        return UNRUNNABLE, 0, {"reason": "git log failed", "stderr": (p.stderr or "")[:160]}
    commits = subprocess.run("git rev-list --all --count", shell=True, cwd=ctx.repo,
                             capture_output=True, text=True).stdout.strip()
    try:
        examined = int(commits or 0)
    except ValueError:
        examined = 0
    if examined == 0:
        return VACUOUS, 0, {"reason": "no commits to scan"}

    unreadable = object()

    def role_of(tok):
        payload = tok.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        try:
            return _json.loads(base64.urlsafe_b64decode(payload)).get("role")
        except Exception:
            return unreadable             # not a JWT we can read; gitleaks' problem

    # Each token is counted once by role, as before; each place an offending
    # one appears is a finding: where it is, never what (see _conceal).
    roles, seen, offending, findings = {}, {}, set(), []
    for commit, path, line, tok in _log_hits(p.stdout or "",
                                             re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")):
        if tok not in seen:
            seen[tok] = role_of(tok)
            if seen[tok] is not unreadable:
                roles[seen[tok]] = roles.get(seen[tok], 0) + 1
        if seen[tok] in ("service_role", "supabase_admin"):
            offending.add(tok)
            findings.append({"file": path, "line": line, "commit": commit,
                             "value_sha256": _fingerprint(tok)})
    if offending:
        evidence = {"roles_found": roles, "offending": len(offending),
                    "findings": findings[:OBJECTS_SHOWN]}
        if len(findings) > OBJECTS_SHOWN:
            evidence["findings_truncated"] = True
        return FAIL, examined, evidence
    # A shallow clone's log is the commits it fetched. A key committed before
    # them and removed since is not in it, so finding none there shows nothing
    # about the history: actions/checkout fetches one commit unless told
    # otherwise, and on that the rule passed on every client. A key that is
    # found is found, shallow or not; only the pass is withheld.
    shallow = subprocess.run("git rev-parse --is-shallow-repository", shell=True, cwd=ctx.repo,
                             capture_output=True, text=True).stdout.strip()
    if shallow != "false":
        return UNPROVABLE, examined, {
            "reason": (f"the clone is shallow: {examined} commit(s) of the history are here, "
                       f"and a key committed before them and removed since would not be. "
                       f"check out the whole history (actions/checkout with fetch-depth: 0)"
                       if shallow == "true" else
                       "git could not say whether the clone is shallow, so the history "
                       "read may not be all of it"),
            "commits": examined}
    return PASS, examined, {"roles_found": roles or {"none": 0}, "commits": examined}


def prim_reconcile(ctx, params):
    m = os.path.join(ctx.repo, params.get("mapping", ""))
    if not os.path.isfile(m):
        return UNRUNNABLE, 0, {"reason": "no mapping file"}
    return UNRUNNABLE, 0, {"reason": "family 4 is not implemented in this version"}


PRIMITIVES = {
    "file_exists@1": prim_file_exists,
    "file_absent@1": prim_file_absent,
    "glob_nonempty@1": prim_glob_nonempty,
    "shell@1": prim_shell,
    "sql_file_clean@1": prim_sql_file_clean,
    "sql_returns_no_rows@1": prim_sql_returns_no_rows,
    "sql_suite@1": prim_sql_suite,
    "schema_equals_migrations@1": prim_schema_equals_migrations,
    "http_smoke@1": prim_http_smoke,
    "no_service_jwt@1": prim_no_service_jwt,
    "reconcile@1": prim_reconcile,
}


# ── waivers ─────────────────────────────────────────────────────────────────
# Outcomes a waiver can cover. `pass` and `not_applicable` are not among them:
# neither blocks, so waiving one is either a misunderstanding or an attempt to
# write a waiver that covers everything by listing everything.
WAIVABLE_OUTCOMES = {FAIL, VACUOUS, UNPROVABLE, UNRUNNABLE}


def load_waivers(path: str, max_days: int, catalog: dict | None = None):
    """A waiver names the outcomes it covers. One written for `unrunnable`
    must not silently start covering `fail`.

    Three refusals found by probing rather than by design:

      An outcome that is not one of the six is refused. `waives: ["maybe"]`
      loaded cleanly and then matched nothing, so the waiver looked active on
      screen and did nothing — worse than being rejected, because someone would
      believe the rule was handled.

      A waiver covering every outcome is refused. Listing all six is not a
      waiver for a rule, it is switching the rule off, and the expiry date stops
      meaning anything.

      A malformed date is a problem rather than a crash. `expires: "soon"` threw
      ValueError out of load_waivers and took the whole run with it, so one
      mistyped date meant no report at all.

    The rest is the waivers contract: a reason long enough to be one, no field
    nobody reads, and, given the catalog, a rule that exists and can be waived
    (cross-check 4). A waiver for a rule the catalog does not have waives
    nothing, and saying so is better than listing it as active.
    """
    if not path or not os.path.isfile(path):
        return [], []
    try:
        data = json.load(open(path, encoding="utf-8"))
    except ValueError as e:
        return [], [{"rule_id": None, "problem": f"the waivers file is not JSON: {e}"}]
    if not isinstance(data, list):
        return [], [{"rule_id": None, "problem": "the waivers file is not a list of waivers"}]
    rules = None
    if catalog is not None:
        rules = {r.get("id"): r for r in catalog.get("rules", []) if isinstance(r, dict)}
    today, live, problems = datetime.date.today(), [], []
    for w in data:
        if not isinstance(w, dict):
            problems.append({"rule_id": None, "problem": "a waiver is not an object"})
            continue
        for field in WAIVER_FIELDS:
            if not w.get(field):
                problems.append({"rule_id": w.get("rule_id"), "problem": f"missing {field}"})
                break
        else:
            shape = _waiver_problem(w, rules)
            if shape:
                problems.append({"rule_id": w["rule_id"], "problem": shape})
                continue
            bad = [o for o in w["waives"] if o not in WAIVABLE_OUTCOMES]
            if bad:
                problems.append({"rule_id": w["rule_id"],
                                 "problem": f"waives {bad} — not outcomes that block"})
                continue
            if set(w["waives"]) >= WAIVABLE_OUTCOMES:
                problems.append({"rule_id": w["rule_id"],
                                 "problem": "waives every blocking outcome — that is "
                                            "switching the rule off, not waiving it"})
                continue
            if not _is_date(w["expires"]):
                problems.append({"rule_id": w["rule_id"],
                                 "problem": f"expires {w['expires']!r} is not a date"})
                continue
            exp = datetime.date.fromisoformat(w["expires"])
            if exp < today:
                problems.append({"rule_id": w["rule_id"], "problem": "expired", "expires": w["expires"]})
            elif (exp - today).days > max_days:
                problems.append({"rule_id": w["rule_id"], "problem": f"expiry beyond {max_days} days"})
            else:
                w["days_left"] = (exp - today).days
                live.append(w)
    return live, problems


def _waiver_problem(w: dict, rules: dict | None) -> str | None:
    """The first way a complete waiver breaks its contract, or None."""
    extra = [k for k in w if not str(k).startswith("$") and k not in WAIVER_FIELDS + WAIVER_OPTIONAL]
    if extra:
        return f"{', '.join(map(str, extra))}: not a waiver field"
    if not (isinstance(w["rule_id"], str) and RULE_ID.fullmatch(w["rule_id"])):
        return f"rule_id {w['rule_id']!r} is not a rule id"
    if rules is not None:
        if w["rule_id"] not in rules:
            return "no such rule in the catalog, so this waives nothing"
        if rules[w["rule_id"]].get("waivable") is not True:
            return "this rule is not waivable"
    waives = w["waives"]
    if not isinstance(waives, list) or not all(isinstance(o, str) for o in waives):
        return "waives is not a list of outcomes"
    if len(set(waives)) != len(waives):
        return "waives names an outcome twice"
    if not isinstance(w["reason"], str) or len(w["reason"]) < 10:
        return "the reason says too little: 10 characters at least, so the next person knows why"
    if not isinstance(w["owner"], str):
        return "owner is not a name"
    objects = w.get("objects")
    if "objects" in w and not (isinstance(objects, list) and objects
                               and all(isinstance(o, str) and o for o in objects)):
        return "objects is not a list of the objects the waiver covers"
    return None


def _covers(waiver: dict, evidence: dict) -> bool:
    """A waiver with `objects` covers a result only when the result names the
    objects it found and every one of them is among those the waiver names.
    Without that, it would cover the whole rule: a waiver written for one
    lookup table would also swallow the next table that turns up."""
    if "objects" not in waiver:
        return True
    found = evidence.get("objects")
    return bool(found) and not evidence.get("objects_truncated") \
        and set(found) <= set(waiver["objects"])


# ── runner ──────────────────────────────────────────────────────────────────
def run(ruleset, ctx, waivers, waiver_problems):
    # A waiver on a rule that cannot be waived is refused here, before anything
    # runs, rather than at the moment that rule happens to fail. An earlier
    # version only refused it on failure, so a waiver that could never apply
    # still appeared under `waivers_active` — the report describing its own
    # state slightly wrong, which is the class of thing it exists to catch.
    not_waivable = {r["rule_id"] for r in ruleset["selected"] if not r["waivable"]}
    still = []
    for w in waivers:
        if w["rule_id"] in not_waivable:
            waiver_problems.append({"rule_id": w["rule_id"],
                                    "problem": "this rule is not waivable"})
        else:
            still.append(w)
    waivers[:] = still

    # A rule whose base did not build has not been tested. It reports
    # unprovable and names what it was waiting on, rather than a fail that
    # cannot be told from a real one.
    #
    # schema.matches_migrations already did this; project.business_rules did
    # not, and it carries the most serious finding in the report. Applying the
    # distinction to one and not the other was the inconsistency.
    outcome_by_rule: dict[str, str] = {}
    today = datetime.date.today()

    results = []
    for rule in ruleset["selected"]:
        # A rule whose base did not build has not been tested. It reports
        # unprovable and names what it was waiting on, rather than a fail that
        # cannot be told from a real one: "owner A sees 0 of its 5 bookings"
        # means one thing when the isolation is broken and another when the
        # table was never created, and they go to different people.
        blocked_by = [d for d in rule.get("depends_on", [])
                      if outcome_by_rule.get(d) not in (None, PASS, NOT_APPLICABLE)]
        if blocked_by:
            outcome, examined, evidence = UNPROVABLE, 0, {
                "reason": (f"{', '.join(blocked_by)} did not pass, so the database "
                           f"this ran against is not the one described. a failure "
                           f"here cannot be told from a missing table."),
                "blocked_by": blocked_by}
            outcome_by_rule[rule["rule_id"]] = outcome
            results.append({**{k: rule[k] for k in
                               ("rule_id", "family", "primitive", "severity")},
                            "outcome": outcome, "examined": examined,
                            "evidence": _net(evidence), "waived_by": None,
                            "empty_population_allowed": _empty_population_holds(rule, today)})
            continue

        fn = PRIMITIVES.get(rule["primitive"])
        if fn is None:
            outcome, examined, evidence = UNRUNNABLE, 0, {
                "reason": f"this binary does not implement {rule['primitive']}"}
        else:
            try:
                outcome, examined, evidence = fn(ctx, _locate(rule["params"]))
            except Exception as e:                      # a crashing primitive is
                outcome, examined, evidence = UNRUNNABLE, 0, {  # not a pass
                    "reason": f"{type(e).__name__}: {e}"}
        if examined is None:                            # the contract, enforced
            outcome, evidence = UNRUNNABLE, {"reason": "the primitive returned no `examined`"}
            examined = 0
        if rule["rule_id"].startswith(SECRET_RULES):    # where, never what
            evidence = _conceal(rule["rule_id"], evidence)
        allowed = _empty_population_holds(rule, today)
        if outcome == VACUOUS and rule.get("empty_population"):
            ep = rule["empty_population"]
            evidence["empty_population"] = {
                "reason": ep.get("reason"), "expires": ep.get("expires"), "expired": not allowed}

        waived_by = None
        for w in waivers:
            if w["rule_id"] == rule["rule_id"] and outcome in w["waives"]:
                if not rule["waivable"]:
                    evidence["waiver_refused"] = "this rule is not waivable"
                    break
                if not _covers(w, evidence):
                    evidence["waiver_does_not_cover"] = {
                        "objects": w["objects"], "found": evidence.get("objects")}
                    continue
                waived_by = f'{w["owner"]} until {w["expires"]}'
                break

        outcome_by_rule[rule["rule_id"]] = outcome
        results.append({**{k: rule[k] for k in
                           ("rule_id", "family", "primitive", "severity")},
                        "outcome": outcome, "examined": examined,
                        # last, after the waivers have read the true object
                        # names: what leaves is concealed, what decided is not
                        "evidence": _net(evidence), "waived_by": waived_by,
                        # what blocks is decided from the report alone, without
                        # the catalog: see blocks()
                        "empty_population_allowed": allowed})
    return results


def blocks(result: dict, catalog_version) -> bool:
    """Whether one row of a report blocks a merge, by the rule of the catalog
    the report was decided by. Before 0.2.0 only a blocking rule blocked; from
    0.2.0 an advisory rule blocks on vacuous too (decision 014), and a vacuous
    result does not block when its rule allowed an empty population on the day
    of the run, which the row says in empty_population_allowed.

    The report carries everything this reads, so a report is decided the same
    way wherever it is read, and an old one still reads as it was decided. A
    catalog_version that is not a release is decided by today's rule."""
    if result.get("waived_by"):
        return False
    outcome, severity = result.get("outcome"), result.get("severity")
    version = catalog_version if isinstance(catalog_version, str) else ""
    if SEMVER.fullmatch(version) and _version(version) < (0, 2, 0):
        return outcome in BLOCKING_OUTCOMES_BEFORE_0_2.get(severity, ())
    if outcome == VACUOUS and result.get("empty_population_allowed") is True:
        return False
    return outcome in BLOCKING_OUTCOMES.get(severity, ())


def report(ruleset, results, waivers, waiver_problems):
    blocking = [r for r in results if blocks(r, ruleset["catalog_version"])]
    summary = {o: sum(1 for r in results if r["outcome"] == o)
               for o in (PASS, FAIL, VACUOUS, NOT_APPLICABLE, UNPROVABLE, UNRUNNABLE)}
    summary["waived"] = sum(1 for r in results if r["waived_by"])
    summary["exit_code"] = 1 if (blocking or waiver_problems) else 0
    return {"schema": REPORT_SCHEMA, **{k: ruleset[k] for k in
                ("ruleset_hash", "catalog_version", "binary_version")},
            "summary": summary, "waivers_active": waivers,
            "waiver_problems": waiver_problems,
            "results": results, "rejected": ruleset["rejected"]}


def render(rep):
    w = 34
    out = [f'ruleset {rep["ruleset_hash"]} · catalog {rep["catalog_version"]} '
           f'· binary {rep["binary_version"]}', ""]
    for r in rep["results"]:
        mark = {PASS: "ok  ", FAIL: "FAIL", VACUOUS: "VAC ", UNPROVABLE: "UNPR",
                UNRUNNABLE: "UNRN", NOT_APPLICABLE: "n/a "}[r["outcome"]]
        note = r["evidence"].get("reason") or r["evidence"].get("violations") or ""
        wv = f'  [waived by {r["waived_by"]}]' if r["waived_by"] else ""
        ep = r["evidence"].get("empty_population")
        if ep and not ep.get("expired"):
            wv += f'  [empty population allowed until {ep["expires"]}]'
        out.append(f'  {mark}  {r["rule_id"]:{w}} examined={r["examined"]:<6} {note}{wv}')
    if rep["rejected"]:
        out += ["", "  not selected:"]
        out += [f'    {x["rule_id"]:{w}} {x["reason"]}' for x in rep["rejected"]]
    for p in rep["waiver_problems"]:
        out.append(f'  WAIVER  {p.get("rule_id")}: {p["problem"]}')
    s = rep["summary"]
    out += ["", f'  {s[PASS]} pass · {s[FAIL]} fail · {s[VACUOUS]} vacuous · '
                f'{s[UNPROVABLE]} unprovable · {s[UNRUNNABLE]} unrunnable · '
                f'{s["waived"]} waived → exit {s["exit_code"]}']
    # it prints more than evidence (why a rule was not selected, who waived
    # what), and every line goes through the same net
    return _scrub("\n".join(out))[0]


# ── agent layer ─────────────────────────────────────────────────────────────
def agent_layer(ruleset: dict, profile: dict) -> str:
    """The instructions loaded into the coding agent, derived from the same
    ruleset the gate runs. Written before the code is, which is the only part
    of this system that prevents rather than catches.

    It carries the ruleset hash so the three can be compared."""
    lines = [
        "<!-- GENERATED by qa-master. Do not edit by hand. -->",
        f"<!-- ruleset: {ruleset['ruleset_hash']} · catalog: {ruleset['catalog_version']} -->",
        "",
        "# כללים שהשער יאכוף על הקוד הזה",
        "",
        "נגזר מהפרופיל, לא נכתב ביד. השער בודק בדיוק את אלה, ולכן קוד שעובר כאן",
        "עובר גם שם.",
        "",
    ]
    by_family = {}
    for r in ruleset["selected"]:
        by_family.setdefault(r["family"], []).append(r)
    names = {1: "הריפו עצמו", 2: "הסכמה", 3: "חוקים מוצהרים מול נתונים",
             4: "מקור חיצוני", 5: "המוצר שרץ"}
    for fam in sorted(by_family):
        lines.append(f"## משפחה {fam} · {names.get(fam, '')}")
        lines.append("")
        for r in sorted(by_family[fam], key=lambda x: x["rule_id"]):
            hard = " **חוסם, ואינו ניתן לוויתור**" if not r["waivable"] else ""
            lines.append(f"- `{r['rule_id']}`{hard}")
        lines.append("")
    if ruleset["rejected"]:
        lines += ["## אינם חלים על הפרויקט הזה", ""]
        lines += [f"- `{x['rule_id']}` — {x['reason']}" for x in ruleset["rejected"]]
        lines.append("")
    return "\n".join(lines)


def layer_hash(text: str) -> str:
    """Only the generated body counts. The header carries the ruleset hash, so
    including it would make the comparison circular."""
    body = "\n".join(l for l in text.splitlines() if not l.startswith("<!--"))
    return hashlib.sha256(body.encode()).hexdigest()[:16]


def triple_match(ruleset: dict, profile: dict, agent_path: str | None):
    """The agent layer and the gate must be two renderings of one ruleset. A
    gap between what the agent was told and what the gate checks is the widest
    hole available here."""
    fresh = agent_layer(ruleset, profile)
    if not agent_path or not os.path.isfile(agent_path):
        return UNRUNNABLE, {"reason": "no agent layer on disk — nothing to compare"}
    on_disk = open(agent_path, encoding="utf-8").read()
    if layer_hash(on_disk) != layer_hash(fresh):
        return FAIL, {"reason": "the agent layer does not match the current ruleset",
                      "on_disk": layer_hash(on_disk), "expected": layer_hash(fresh)}
    m = re.search(r"ruleset: (\w+)", on_disk)
    if not m or m.group(1) != ruleset["ruleset_hash"]:
        return FAIL, {"reason": "the agent layer names a different ruleset",
                      "names": m.group(1) if m else None,
                      "expected": ruleset["ruleset_hash"]}
    return PASS, {"ruleset_hash": ruleset["ruleset_hash"]}


# ── the client: sync, resolve, verify ───────────────────────────────────────
# The engine reaches a client through sync, at the catalog release the client
# pins, into qa-master/generated/engine/ (decision 007). resolve writes the lock
# beside it, and verify checks both in the client's CI. Nothing under generated/
# is edited by hand: every file there is reproduced byte for byte, so none
# carries a timestamp (decision 009).
#
# Where they are is the client layout (contracts/client-layout.json);
# tests/test_contracts.py keeps these equal to it.
PROFILE_PATH = "qa-master/profile.json"
LOCK_PATH = "qa-master/generated/ruleset.lock.json"
ENGINE_PATH = "qa-master/generated/engine"
LOCK_SCHEMA = "ruleset.lock/1"

# What sync writes, and so everything engine_hash covers: <path under
# generated/engine/> -> <path in the qa-master repository>. The one list.
SYNC_FILES = {
    "qa_master.py":                             "engine/qa_master.py",
    "catalog.json":                             "catalog/catalog.json",
    "dimensions.json":                          "catalog/dimensions.json",
    "platforms/supabase/harness/auth-stub.sql": "engine/platforms/supabase/harness/auth-stub.sql",
    "platforms/supabase/harness/grants.sql":    "engine/platforms/supabase/harness/grants.sql",
    "gate/check-gates.sh":                      "engine/gate/check-gates.sh",
    "tools/check-copies.py":                    "engine/tools/check-copies.py",
}


class Refused(Exception):
    """An input the engine will not work from. The lines say why, one each."""
    def __init__(self, what: str, lines: list[str]):
        super().__init__(what)
        self.what, self.lines = what, lines


def engine_hash(engine_dir: str) -> str:
    """SHA-256 over the sorted lines `<path>\\0<sha256 of its bytes>\\n`, one per
    file under engine_dir, paths relative to it (contracts-spec §2.7)."""
    if not os.path.isdir(engine_dir):
        raise Refused("no engine", [f"{engine_dir} does not exist · run sync first"])
    lines = []
    for root, _dirs, files in os.walk(engine_dir):
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, engine_dir).replace(os.sep, "/")
            with open(full, "rb") as f:
                lines.append(f"{rel}\0{hashlib.sha256(f.read()).hexdigest()}\n")
    return hashlib.sha256("".join(sorted(lines)).encode("utf-8")).hexdigest()


def resolve(profile: dict, catalog: dict, engine_dir: str) -> dict:
    """profile + catalog -> the lock (contracts-spec §2.7). Pure apart from
    reading engine_dir, and free of timestamps: resolving twice gives the same
    bytes, so CI can compare the committed lock with a fresh one."""
    if profile["catalog_pin"] != catalog["catalog_version"]:
        raise Refused("the catalog is not the pinned one", [
            f"the profile pins catalog {profile['catalog_pin']}; the catalog is "
            f"{catalog['catalog_version']} · run sync, which writes the pinned release"])
    ruleset = select(profile, catalog)
    return {
        "schema": LOCK_SCHEMA,
        "catalog_pin": profile["catalog_pin"],
        "ruleset_hash": ruleset["ruleset_hash"],
        "engine_hash": engine_hash(engine_dir),
        "catalog_hash": canonical_hash(catalog),
        "profile_hash": canonical_hash(profile),
        "selected": sorted(({"rule_id": r["rule_id"], "severity": r["severity"],
                             "primitive": r["primitive"]} for r in ruleset["selected"]),
                           key=lambda r: r["rule_id"]),
        "rejected": sorted(ruleset["rejected"], key=lambda r: (r["rule_id"], r["reason"])),
        "binary_version": BINARY_VERSION,
    }


def lock_bytes(lock: dict) -> bytes:
    return (json.dumps(lock, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def verify_lock(profile: dict, catalog: dict, engine_dir: str, lock_path: str) -> list[str]:
    """What separates the committed lock from a fresh resolve, or nothing.

    The engine is named apart from the rest: a lock that disagrees with the
    files in generated/engine/ means the engine was edited there, or synced
    without resolving, and either way the rules ran on code nobody pinned."""
    if not os.path.isfile(lock_path):
        return [f"no lock at {lock_path} · run resolve"]
    with open(lock_path, "rb") as f:
        on_disk = f.read().replace(b"\r\n", b"\n")
    fresh = resolve(profile, catalog, engine_dir)
    if on_disk == lock_bytes(fresh):
        return []
    try:
        committed = json.loads(on_disk)
    except ValueError:
        return ["the lock is not JSON · nothing under generated/ is edited by hand; run resolve"]
    if not isinstance(committed, dict):
        return ["the lock is not a JSON object · run resolve"]
    problems = []
    if committed.get("engine_hash") != fresh["engine_hash"]:
        problems.append(f"engine_hash: the lock says {committed.get('engine_hash')}, the files in "
                        f"{engine_dir} hash to {fresh['engine_hash']} · a file there changed after "
                        f"resolve; run sync at the pin, then resolve")
    for key in fresh:
        if key != "engine_hash" and committed.get(key) != fresh[key]:
            problems.append(f"{key}: the lock differs from a fresh resolve")
    problems += [f"{key}: in the lock, and not in a fresh resolve" for key in committed
                 if key not in fresh]
    return problems or ["the lock differs from a fresh resolve in its bytes · nothing under "
                        "generated/ is edited by hand; run resolve"]


def sync(source: str, ref: str, engine_dir: str) -> dict:
    """Writes the engine at `ref` of a qa-master repository into engine_dir.

    It reads blobs with `git show`: no network, no checkout, and the bytes are
    the repository's. Nothing is written until every file has been read, so a
    missing one leaves the old engine whole. Afterwards the folder holds these
    files and nothing else, since engine_hash covers every file in it."""
    blobs = {}
    for dst, src in SYNC_FILES.items():
        p = subprocess.run(["git", "-C", source, "show", f"{ref}:{src}"], capture_output=True)
        if p.returncode != 0:
            raise Refused("sync read nothing", [
                f"{ref}:{src} · {p.stderr.decode('utf-8', 'replace').strip()}"])
        blobs[dst] = p.stdout
    if os.path.isdir(engine_dir):
        for root, dirs, files in os.walk(engine_dir, topdown=False):
            for name in files:
                full = os.path.join(root, name)
                if os.path.relpath(full, engine_dir).replace(os.sep, "/") not in blobs:
                    os.remove(full)
            for name in dirs:
                if not os.listdir(os.path.join(root, name)):
                    os.rmdir(os.path.join(root, name))
    for dst, data in blobs.items():
        full = os.path.join(engine_dir, *dst.split("/"))
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(data)
    return blobs


# ── self-test ───────────────────────────────────────────────────────────────
def self_test() -> int:
    """Every primitive must be seen to fail, not only to pass. A gate that has
    never been observed failing is not evidence."""
    import tempfile
    ok = bad = 0
    with tempfile.TemporaryDirectory() as d:
        open(os.path.join(d, "there.txt"), "w").close()
        ctx = Ctx(d, None)
        cases = [
            ("file_exists  passes", prim_file_exists, {"path": "there.txt"}, PASS),
            ("file_exists  fails",  prim_file_exists, {"path": "nope.txt"},  FAIL),
            ("file_absent  passes", prim_file_absent, {"path": "nope.txt"},  PASS),
            ("file_absent  fails",  prim_file_absent, {"path": "there.txt"}, FAIL),
            ("glob         fails",  prim_glob_nonempty, {"glob": "*.sql"},   FAIL),
            ("sql w/o db   unrunnable", prim_sql_returns_no_rows,
             {"predicate": "select 1", "population": "select 1"}, UNRUNNABLE),
        ]
        for name, fn, params, want in cases:
            got, examined, _ = fn(ctx, params)
            good = got == want
            print(f'  {"ok " if good else "!! "} {name:26} got={got} examined={examined}')
            ok += good; bad += not good
    print(f"\n  {ok} of {ok+bad} primitive checks passed")
    return 0 if bad == 0 else 1


# ── cli ─────────────────────────────────────────────────────────────────────
def _read_json(path: str, what: str):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except OSError as e:
        raise Refused(f"{what} was rejected", [f"{path}: {e.strerror or e}"])
    except ValueError as e:
        raise Refused(f"{what} was rejected", [f"{path} is not JSON: {e}"])


def load_inputs(profile_path: str, catalog_path: str):
    """The profile and the catalog, each checked against its contract. The
    vocabulary is read from dimensions.json beside the catalog, which is where
    sync puts it in a client and where it lives here. The profile comes back as
    the engine reads it, with the vocabulary's defaults (with_defaults)."""
    profile = _read_json(profile_path, "the profile")
    catalog = _read_json(catalog_path, "the catalog")
    dpath = os.path.join(os.path.dirname(os.path.abspath(catalog_path)), "dimensions.json")
    if not os.path.isfile(dpath):
        raise Refused("the profile cannot be checked",
                      [f"no dimensions.json beside the catalog, at {dpath}"])
    dimensions = _read_json(dpath, "the vocabulary")
    problems = validate_profile(profile, dimensions)
    if problems:
        raise Refused("the profile was rejected", problems)
    problems = validate_catalog(catalog, dimensions)
    if problems:
        raise Refused("the catalog was rejected", problems)
    return with_defaults(profile, dimensions), catalog


def main() -> int:
    ap = argparse.ArgumentParser(prog="qa-master")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("select", "run"):
        s = sub.add_parser(name)
        s.add_argument("--profile", required=True)
        s.add_argument("--catalog", required=True)
        s.add_argument("--json", action="store_true")
        if name == "run":
            s.add_argument("--db")
            s.add_argument("--repo", default=".")
            s.add_argument("--waivers")
            s.add_argument("--out")
    ag = sub.add_parser("agent")
    ag.add_argument("--profile", required=True)
    ag.add_argument("--catalog", required=True)
    ag.add_argument("--out")
    client = ("in a client, every path defaults to its place in the layout "
              "under --root: qa-master/profile.json, qa-master/generated/engine/")
    rs = sub.add_parser("resolve", help="profile + catalog -> the lock", description=client)
    vf = sub.add_parser("verify", description=client + ". The lock is checked unless "
                        "only --agent is given; with --agent, the agent layer too")
    for s in (rs, vf):
        s.add_argument("--root", default=".", help="the client repository (default: .)")
        s.add_argument("--profile")
        s.add_argument("--catalog")
        s.add_argument("--engine-dir")
    rs.add_argument("--out", help="the lock (default: qa-master/generated/ruleset.lock.json)")
    vf.add_argument("--lock")
    vf.add_argument("--agent")
    sy = sub.add_parser("sync", help="the engine at the pin -> qa-master/generated/engine/")
    sy.add_argument("--from", dest="source", required=True,
                    help="a qa-master repository, read with git show")
    sy.add_argument("--ref", help="default: the tag catalog-v<catalog_pin of the profile>")
    sy.add_argument("--root", default=".", help="the client repository (default: .)")
    sy.add_argument("--profile")
    sub.add_parser("self-test")
    a = ap.parse_args()

    if a.cmd == "self-test":
        return self_test()
    try:
        return _command(a)
    except Refused as e:
        print(f"{e.what}:\n", file=sys.stderr)
        for line in e.lines:
            print(f"  {line}\n", file=sys.stderr)
        return 2


def _command(a) -> int:
    if a.cmd == "sync":
        ref = a.ref
        if ref is None:
            profile = _read_json(a.profile or os.path.join(a.root, PROFILE_PATH), "the profile")
            pin = profile.get("catalog_pin") if isinstance(profile, dict) else None
            if not (isinstance(pin, str) and SEMVER.fullmatch(pin)):
                raise Refused("no release to sync", ["the profile has no catalog_pin · "
                                                     "set it, or pass --ref"])
            ref = f"catalog-v{pin}"
        dest = os.path.join(a.root, ENGINE_PATH)
        written = sync(a.source, ref, dest)
        version = json.loads(written["catalog.json"]).get("catalog_version")
        print(f"synced {ref} into {dest} · {len(written)} files · catalog {version} · "
              f"engine {engine_hash(dest)}")
        return 0

    if a.cmd in ("resolve", "verify"):
        engine_dir = a.engine_dir or os.path.join(a.root, ENGINE_PATH)
        profile, catalog = load_inputs(a.profile or os.path.join(a.root, PROFILE_PATH),
                                       a.catalog or os.path.join(engine_dir, "catalog.json"))
        if a.cmd == "resolve":
            out = a.out or os.path.join(a.root, LOCK_PATH)
            lock = resolve(profile, catalog, engine_dir)
            os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
            with open(out, "wb") as f:
                f.write(lock_bytes(lock))
            print(f"wrote {out} · ruleset {lock['ruleset_hash']} · engine {lock['engine_hash']}")
            return 0
        failed = False
        if a.lock is not None or a.agent is None:
            lock_path = a.lock or os.path.join(a.root, LOCK_PATH)
            problems = verify_lock(profile, catalog, engine_dir, lock_path)
            if problems:
                failed = True
                print(f"lock: fail · {lock_path}")
                for p_ in problems:
                    print(f"  {p_}")
            else:
                print(f"lock: pass · ruleset {select(profile, catalog)['ruleset_hash']} · "
                      f"engine {engine_hash(engine_dir)}")
        if a.agent is not None:
            outcome, ev = triple_match(select(profile, catalog), profile, a.agent)
            failed |= outcome != PASS
            print(f"triple match: {outcome}" + (f" · {ev.get('reason')}" if outcome != PASS else
                  f" · ruleset {ev['ruleset_hash']}"))
        return 1 if failed else 0

    profile, catalog = load_inputs(a.profile, a.catalog)
    ruleset = select(profile, catalog)

    if a.cmd == "agent":
        text = agent_layer(ruleset, profile)
        if a.out:
            open(a.out, "w", encoding="utf-8").write(text)
            print(f"wrote {a.out} · ruleset {ruleset['ruleset_hash']} · layer {layer_hash(text)}")
        else:
            print(text)
        return 0

    if a.cmd == "select":
        if a.json:
            print(json.dumps(ruleset, ensure_ascii=False, indent=2))
        else:
            print(f'ruleset {ruleset["ruleset_hash"]}')
            for r in ruleset["selected"]:
                print(f'  selected  {r["rule_id"]:34} family {r["family"]}')
            for r in ruleset["rejected"]:
                print(f'  rejected  {r["rule_id"]:34} {r["reason"]}')
        return 0

    waivers, problems = load_waivers(a.waivers, catalog.get("max_waiver_days", 30), catalog)
    results = run(ruleset, Ctx(a.repo, a.db), waivers, problems)
    rep = report(ruleset, results, waivers, problems)
    if a.out:
        json.dump(rep, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(rep, ensure_ascii=False, indent=2) if a.json else render(rep))
    return rep["summary"]["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
