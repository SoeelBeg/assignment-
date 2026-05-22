# Nestack Submission

## Setup

```bash
npm install
npm start
```

Server runs on:

```txt
http://localhost:3000
```

## HMAC Verification

Header:

X-Webhook-Signature

Algorithm:

HMAC-SHA256

Secret key:

nestack_secret

## Retry Schedule

- Immediate
- 30 seconds
- 5 minutes
- 30 minutes

After failed retries event becomes dead.

## Restart Behaviour

SQLite persists retry data.
After restart the worker resumes pending retries from database.