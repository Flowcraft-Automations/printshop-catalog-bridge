#!/usr/bin/env bash
# The contract every gate in a client's gates directory (GATES/*.gate.sql) must
# meet.
#
# The same fault was found twice, in two gates: a check that passed because it
# had nothing to examine. Two instances of one fault point to a missing
# constraint, not to two bugs. This script is that constraint. It finds the
# gates by glob, never from a list, so a new gate is held to the contract
# without anyone registering it.
#
#   lint   GATES       no database. For each gate: one declared population per
#                      rule, and one break per rule.
#   empty  GATES URL   every gate must refuse with VACUOUS <its name>.
#   seeded GATES URL   every gate must pass.
#   breaks GATES URL   every break, in a transaction, must FAIL its own gate on
#                      exactly the gap its first line names. Then it is rolled back.
#
# GATES is a directory, such as client-config/gates, relative to where this runs.
#
# What a gate must look like, so this can read it:
#   - a coverage list, one row per rule:   ('#N <what it scans>', (select count(*) ...)),
#   - rules in the query are joined by `union all`, each on its own line,
#   - VACUOUS <name> when any rule saw nothing, FAIL <name> : ... — <gaps> otherwise,
#   - breaks in GATES/break/<name>/rule-N.sql, first line
#     `-- expect: <gap>`.
set -uo pipefail
mode=${1:?lint GATES | empty GATES URL | seeded GATES URL | breaks GATES URL}
GATES=${2:?the gates directory, such as client-config/gates}
BREAKS=$GATES/break
URL=${3:-}
bad=0
no() { echo "  ✗ $*"; bad=$((bad + 1)); }

shopt -s nullglob
gates=("$GATES"/*.gate.sql)
[ ${#gates[@]} -gt 0 ] || { echo "no gates found under $GATES"; exit 1; }

for gate in "${gates[@]}"; do
  name=$(basename "$gate" .gate.sql)
  before=$bad
  case "$mode" in

  lint)
    rules=$(( $(grep -cE '^\s*union all\s*$' "$gate") + 1 ))
    declared=$(grep -cE "^\s+\('#[0-9]+ " "$gate")
    breaks=("$BREAKS/$name"/rule-*.sql)
    [ "$declared" -eq "$rules" ] \
      || no "$name: $rules rules, $declared declared populations. Each rule must declare the population it scans"
    [ ${#breaks[@]} -eq "$rules" ] \
      || no "$name: $rules rules, ${#breaks[@]} breaks in $BREAKS/$name/. Each rule must be seen to fail"
    for f in "${breaks[@]}"; do
      sed -n '1{/^-- expect: ./q0;q1}' "$f" || no "$f: the first line is not '-- expect: <gap>'"
    done
    [ $bad -eq $before ] && echo "  $name: $rules rules, each declared and each with a break"
    ;;

  empty)
    if psql "$URL" -v ON_ERROR_STOP=1 -f "$gate" 2>/tmp/gate.err >/dev/null; then
      no "$name passed on an empty database. It examined nothing and reported success"
    elif ! grep -q "VACUOUS $name " /tmp/gate.err; then
      no "$name refused, but not with VACUOUS $name:"; sed 's/^/      /' /tmp/gate.err
    else
      echo "  $name: VACUOUS, as it should be"
    fi
    ;;

  seeded)
    if psql "$URL" -v ON_ERROR_STOP=1 -f "$gate" 2>/tmp/gate.err >/dev/null; then
      echo "  $name: passed"
    else
      no "$name did not pass on the seeded model:"; sed 's/^/      /' /tmp/gate.err
    fi
    ;;

  breaks)
    for f in "$BREAKS/$name"/rule-*.sql; do
      want=$(sed -n '1s/^-- expect: //p' "$f")
      if psql "$URL" -v ON_ERROR_STOP=1 -c begin -f "$f" -f "$gate" -c rollback 2>/tmp/gate.err >/dev/null; then
        no "$f: $name passed over a broken model"; continue
      fi
      # A break for rule 6 that fired rule 1 has proved nothing about rule 6:
      # the gaps after the dash must be this one, and only this one.
      if awk -v p="FAIL $name " -v w="— $want" \
           'index($0, p) && substr($0, length($0) - length(w) + 1) == w { f = 1 } END { exit !f }' /tmp/gate.err; then
        echo "  $name/$(basename "$f"): failed on $want"
      else
        no "$f: expected FAIL $name on exactly '$want':"; sed 's/^/      /' /tmp/gate.err
      fi
    done
    ;;

  *) echo "unknown mode: $mode"; exit 2 ;;
  esac
done
[ $bad -eq 0 ]
