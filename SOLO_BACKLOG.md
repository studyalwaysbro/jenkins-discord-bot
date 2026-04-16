# Jenkins Solo Backlog

## Highest ROI

- Add one machine-readable health artifact for all Jenkins processes:
  Discord bot, Telegram bot, dashboard, restart count, last error, last successful heartbeat.
- Group repeated failures into incidents instead of spamming separate alerts.
- Add one operator-facing summary command or script that answers:
  what is online, what restarted, what is failing, what needs action.

## Reliability

- Track restart causes in one place instead of relying on PM2/log archaeology.
- Add a health check for voice/TTS/STT availability so API failures are obvious.
- Add a dashboard/status view that distinguishes:
  healthy, degraded, offline.

## Noise Reduction

- Add severity levels for alerts.
- Suppress repeated identical alerts with counters and cooldowns.
- Separate observability messages from messages that require action.

## Nice To Have

- Daily ops summary with:
  restarts, failed services, degraded APIs, last council/sermon/game-night status.
- One compact incident log under `data/` or `logs/`.

## Build Order

1. health artifact
2. incident grouping
3. operator summary
4. quieter alert policy
