---
name: GitHub push authentication
description: Secure GitHub pushes depend on a valid PAT with repository write access.
---

Use a credential-free remote URL and pass the GitHub token through the secure environment mechanism. If GitHub returns invalid credentials, confirm the token is a current PAT with write access to the target repository; a secret request alone does not guarantee the stored value or scopes changed.

**Why:** The repository update can be fully verified and committed locally while push still fails when the configured PAT is expired, unchanged, or lacks repository permissions.

**How to apply:** Never put a token in a remote URL or chat. Keep the remote clean, use an authorization header, and stop after repeated authentication failures rather than exposing or guessing credentials.