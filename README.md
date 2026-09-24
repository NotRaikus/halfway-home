# Halfway Home

A little pixel home between Italy and Thailand, with a siamese cat to raise together.
Game Boy Advance style, made for two iPhones: open the link in Safari, then
Share → Add to Home Screen.

## How it works

- Plain HTML + JavaScript modules, no build step. GitHub Pages serves the folder as is.
- Shared state lives in Firebase Realtime Database under `homes/<home id>`.
  The home id is a random 12-character code carried in the invite link (`?home=...`).
- With `FIREBASE = null` in `js/config.js` the game runs offline in one browser;
  open two tabs with `?as=a` and `?as=b` to play both sides.

## Database rules

Nobody can list homes; a home can only be opened by whoever has its link.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "homes": {
      "$home": {
        ".read": "$home.length >= 10",
        ".write": "$home.length >= 10"
      }
    }
  }
}
```

## Run locally

```bash
python -m http.server 8321
```

Arrows move, Z = A, X = B, Enter = Start.

## Roadmap

1. Room, two players, the cat, notes, calendar ✔
2. Furniture, shop, coins
3. Turn-based minigames, Thai ↔ Italian language school, push notifications
4. More rooms
