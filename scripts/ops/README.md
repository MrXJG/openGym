# Operational helpers

`check-upstream-bark.sh` checks the upstream `main` ref and sends one Bark notification per new commit. The first run records a baseline without sending a notification. The watcher does not merge, build, or deploy code; those steps remain explicit and are verified separately.

The systemd unit and timer are installed on the deployment host by copying the script to `/usr/local/libexec/opengym-upstream-watch` and enabling `opengym-upstream-watch.timer`. The host keeps its Bark credentials in `/etc/opengym-upstream-watch.env` with mode `0600`:

```ini
BARK_KEY=your-device-key
BARK_ENDPOINT=https://api.day.app/push
```
