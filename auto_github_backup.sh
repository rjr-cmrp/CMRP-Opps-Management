#!/bin/zsh
# Automated GitHub backup script for CMRP Opps Management
# Adds, commits (if changes), and pushes to remote

cd "/Users/reuelrivera/Documents/CMRP Opps Management"

# Check for changes
if [[ -n $(git status --porcelain) ]]; then
  git add -A
  git commit -m "Automated backup: $(date '+%Y-%m-%d %H:%M:%S')"
  git push origin master
else
  echo "No changes to back up."
fi
