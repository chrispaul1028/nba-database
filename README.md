# NBA Database — Contracts App

Live front end for your Airtable NBA base. Airtable stays the database;
this app is the clean mobile view.

## Deploy (one time, ~20 min)

### 1. Airtable token
1. Go to https://airtable.com/create/tokens
2. Create token → name it "nba-app"
3. Scope: **data.records:read**
4. Access: select your NBA base
5. Copy the token (starts with `pat...`) — you'll paste it into Vercel

### 2. Base ID
Open your base in the browser. The URL looks like
`airtable.com/appXXXXXXXXXXXXXX/...` — the part starting with `app`
is your Base ID. Copy it.

### 3. GitHub
1. Create a free account at github.com if you don't have one
2. New repository → name it `nba-database` → Create
3. "uploading an existing file" link → drag ALL files/folders from this
   project in (keep the folder structure: api/, src/, index.html, etc.)
4. Commit changes

### 4. Vercel
1. vercel.com → sign up **with GitHub** (one click, connects them)
2. Add New → Project → Import your `nba-database` repo
3. Before deploying, open **Environment Variables** and add:
   - `AIRTABLE_TOKEN` = your pat... token
   - `AIRTABLE_BASE_ID` = your app... id
4. Deploy. You get a URL like `nba-database.vercel.app`

### 5. Phone
Open the URL on your phone → Share → **Add to Home Screen**.
It now opens like an app.

## If data doesn't load
The error message on screen will say why. Most common cause: a field
name mismatch. Open `api/contracts.js` — the `T` and `F` objects at the
top list every table and field name the app expects. Edit them to match
your base exactly (capitalization matters), commit the change on GitHub,
and Vercel redeploys automatically.

## Updating data
No steps. Edit Airtable → refresh the app. (Results are cached ~5 min.)
