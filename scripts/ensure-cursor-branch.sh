#!/bin/bash

set -e

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "cursor" ]; then
  echo "\n❌ Deploy blocked: current branch is '$CURRENT_BRANCH'."
  echo "✅ Only the 'cursor' branch is allowed to deploy. Switch branches and try again.\n"
  exit 1
fi

echo "✅ Branch check passed: on 'cursor'. Proceeding with deploy..."


