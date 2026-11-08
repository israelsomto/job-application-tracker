# Job Application Tracker

A full-stack kanban board for tracking job applications. Each application is a card that moves through five stages: **Wishlist → Applied → Interview → Offer → Rejected**.

**Live demo:** https://job-application-tracker-1o8l.onrender.com
*(Hosted on a free tier, so the first load can take up to a minute. Demo data may reset.)*

## Why I built it
Job hunting gets messy across emails, screenshots and memory. I built a tool to keep every application in one place, and I use it for my own job search.

## Features
- Sign up and log in, with a private board for each user
- Add, edit and delete applications (company, role, date, link, notes)
- Drag and drop cards between stages, or use the "Move to" dropdown on mobile
- Search by company or role, and filter by stage
- Live card count per column
- Responsive layout for desktop and phone

## Tech stack
- **Front end:** HTML, CSS, vanilla JavaScript
- **Back end:** Python, Flask (REST API)
- **Database:** SQLite
- **Hosting:** Render, with code on GitHub

## Security
- Passwords are hashed and never stored in plain text
- Session-based login, with protected routes
- Every database query is limited to the logged-in user, so users can't see or change each other's data
- SQL queries use parameters to prevent SQL injection

## API
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/jobs` | List your applications |
| POST | `/api/jobs` | Add an application |
| PUT | `/api/jobs/<id>` | Edit or move an application |
| DELETE | `/api/jobs/<id>` | Delete an application |

## Run it locally
```bash
git clone https://github.com/israelsomto/job-application-tracker.git
cd job-application-tracker
pip install -r requirements.txt
python app.py
```
Then open http://127.0.0.1:5000


## Roadmap
- Move from SQLite to PostgreSQL for persistent data
- Stats page (applications per week, response rate)
- CSV export and follow-up reminders
- Split the front end onto Netlify with the API on Render