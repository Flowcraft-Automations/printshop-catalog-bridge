"""Every copy in a repository names its source, and still matches it.

A copy that drifted from its source still looks valid, and that is the fault
this product exists to catch. It had turned up three times in two days: a gate
that quoted its source "unchanged" and was a snapshot from before the source
grew 20 names, a seed that copied that gate, and a schema dump nine days and 13
migrations behind. A check per copy would itself be a copy of this rule. This
is the one check, for all of them.

Two kinds of provenance, declared in the file's first lines:

    -- vg:copy-of:      <source>:<path>@<sha>
    -- vg:derived-from: <source>:<path>@<sha>

copy-of      verbatim. The copied region sits between `-- vg:copy-begin` and
             `-- vg:copy-end`, and is compared with the source after the
             normalisation below.
derived-from built from the source, such as a dump of a database built from
             migrations. It cannot be compared line by line, so the question
             is whether the source has changed since <sha>.

    check-copies.py lint --root DIR --config FILE
        No source needed. Every tracked file that is a copy by what it
        contains declares provenance, and every declaration is well formed. A
        copy that does not say it is one is how the first three got through.
        What makes a file a copy is read from the file (MARKS), not from a
        list of paths: a list is kept by hand, and a copy put one directory
        off from it was never checked, and nothing said so.

    check-copies.py check --root DIR --config FILE --source <client-repo>=PATH [--ref REF]
        Needs a checkout of the source. A copy-of region must equal the
        source at REF (default: the source's configured ref, via origin/). If
        it does not, it tells apart "the source moved" (the copy equals the
        source at <sha>) from "the copy was edited" (it equals neither). A
        derived-from is stale if any commit in <sha>..REF touches <path>.

--root is the repository whose tracked files are read. --config names the
sources copies may come from, such as client-config/copies.json:
{"sources": {"<client-repo>": {"repo": "<owner>/<name>", "ref": "main"}}}.

Normalisation, which is what a wrapper may change: comment-only lines and
trailing `-- ...` comments are dropped, runs of whitespace are collapsed, blank
lines are dropped, and one trailing `;` is removed. A `--` inside a string
literal would be cut, and none of the current copies has one.
"""
import argparse, json, pathlib, re, subprocess, sys

DECL = re.compile(r'^--\s*vg:(copy-of|derived-from):\s*([A-Za-z0-9_.-]+):(\S+)@([0-9a-f]{40})\s*$')
HEAD_LINES = 40
# What makes a file a copy, by its own content, wherever it sits.
MARKS = [
    ('a vg:copy-begin … vg:copy-end region', re.compile(r'^--\s*vg:copy-(begin|end)\s*$')),
    ('pg_dump output',                       re.compile(r'^--\s*Dumped (from database|by pg_dump) version')),
    ("a gate, which wraps one of the source's checks", re.compile(r'^do\s+\$gate\$')),
]


def norm(text):
    out = []
    for line in text.splitlines():
        if line.strip().startswith('--'):
            continue
        line = ' '.join(re.sub(r'\s+--.*$', '', line).split())
        if line:
            out.append(line)
    s = '\n'.join(out).rstrip()
    return s[:-1].rstrip() if s.endswith(';') else s


def read(path):
    data = path.read_bytes()
    return None if b'\0' in data else data.decode('utf-8', errors='replace').splitlines()


def marks(lines):
    return [what for what, rx in MARKS if any(rx.match(l.strip()) for l in lines)]


def declarations(path):
    lines = read(path) or []
    found, loose = [], []
    for line in lines[:HEAD_LINES]:
        m = DECL.match(line.strip())
        if m:
            found.append(dict(kind=m[1], source=m[2], path=m[3], sha=m[4]))
        elif re.match(r'^--\s*vg:(copy-of|derived-from)', line.strip()):
            loose.append(line.strip())
    return found, loose, lines


def region(lines):
    b = [i for i, l in enumerate(lines) if l.strip() == '-- vg:copy-begin']
    e = [i for i, l in enumerate(lines) if l.strip() == '-- vg:copy-end']
    if len(b) != 1 or len(e) != 1 or e[0] < b[0]:
        return None
    return '\n'.join(lines[b[0] + 1:e[0]])


def tracked(root):
    out = subprocess.run(['git', '-C', str(root), 'ls-files'], capture_output=True,
                         text=True, encoding='utf-8').stdout
    return [root / p for p in out.splitlines()]


def lint(cfg, root):
    bad = 0
    seen = 0
    for f in tracked(root):
        if not f.is_file() or read(f) is None:
            continue
        rel = f.relative_to(root).as_posix()
        decls, loose, lines = declarations(f)
        why = marks(lines)
        if not (why or decls):
            continue
        seen += 1
        for l in loose:
            print(f'  ✗ {rel}: malformed provenance line: {l}'); bad += 1
        if not decls:
            print(f"  ✗ {rel}: contains {' and '.join(why)}, "
                  'so it is a copy, and must declare of what (vg:copy-of or vg:derived-from)'); bad += 1
            continue
        for d in decls:
            if d['source'] not in cfg['sources']:
                print(f"  ✗ {rel}: unknown source '{d['source']}'"); bad += 1
        if any(d['kind'] == 'copy-of' for d in decls) and region(lines) is None:
            print(f'  ✗ {rel}: copy-of needs exactly one vg:copy-begin … vg:copy-end region'); bad += 1
    print(f'  {seen} files must carry provenance' + ('' if bad else ', all well formed'))
    return bad


def git(repo, *args):
    return subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True, encoding='utf-8')


def check(cfg, sources, ref_override, root):
    bad = 0
    files = [f for f in tracked(root) if declarations(f)[0]]
    for f in sorted(files):
        rel = f.relative_to(root).as_posix()
        decls, _, lines = declarations(f)
        for d in decls:
            repo = sources.get(d['source'])
            if repo is None:
                print(f"  ?  {rel}: source '{d['source']}' not given, not checked"); continue
            ref = ref_override or 'origin/' + cfg['sources'][d['source']]['ref']
            if git(repo, 'cat-file', '-e', d['sha'] + '^{commit}').returncode != 0:
                print(f"  ✗ {rel}: {d['sha'][:7]} is not a commit in {d['source']}"); bad += 1; continue
            if d['kind'] == 'derived-from':
                later = git(repo, 'log', '--format=%h %cs %s', f"{d['sha']}..{ref}", '--', d['path']).stdout.splitlines()
                if later:
                    print(f"  ✗ {rel}: derived from {d['source']}:{d['path']}@{d['sha'][:7]}, "
                          f"and {len(later)} commit(s) have changed it since. Newest: {later[0]}"); bad += 1
                else:
                    print(f"  {rel}: current with {d['source']}:{d['path']}")
                continue
            now = git(repo, 'show', f"{ref}:{d['path']}")
            if now.returncode != 0:
                print(f"  ✗ {rel}: {d['source']}:{d['path']} does not exist at {ref}. The source is gone"); bad += 1; continue
            mine = norm(region(lines) or '')
            if mine == norm(now.stdout):
                print(f"  {rel}: identical to {d['source']}:{d['path']} at {ref}")
                continue
            then = git(repo, 'show', f"{d['sha']}:{d['path']}").stdout
            if mine == norm(then):
                later = git(repo, 'log', '--format=%h %cs', f"{d['sha']}..{ref}", '--', d['path']).stdout.splitlines()
                print(f"  ✗ {rel}: the source moved. It equals {d['path']}@{d['sha'][:7]}, "
                      f"and {len(later)} commit(s) have changed the source since"); bad += 1
            else:
                print(f"  ✗ {rel}: the copy was edited. It matches {d['path']} neither at "
                      f"{d['sha'][:7]} nor at {ref}"); bad += 1
    return bad


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('mode', choices=['lint', 'check'])
    ap.add_argument('--root', required=True, type=pathlib.Path, metavar='DIR',
                    help='the repository whose tracked files are read')
    ap.add_argument('--config', required=True, type=pathlib.Path, metavar='FILE',
                    help='the sources copies may come from, such as client-config/copies.json')
    ap.add_argument('--source', action='append', default=[], metavar='NAME=PATH')
    ap.add_argument('--ref')
    a = ap.parse_args()
    root = a.root.resolve()
    cfg = json.loads(a.config.read_text(encoding='utf-8'))
    if a.mode == 'lint':
        sys.exit(1 if lint(cfg, root) else 0)
    sources = dict(s.split('=', 1) for s in a.source)
    if not sources:
        sys.exit('check needs --source NAME=PATH: a checkout of the source repository')
    sys.exit(1 if check(cfg, sources, a.ref, root) else 0)


if __name__ == '__main__':
    main()
