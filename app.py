import os
import sqlite3
from functools import wraps

from flask import (
    Flask, jsonify, request, render_template,
    g, session, redirect, url_for,
)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-change-me")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("RENDER") == "true"

DATABASE = "tracker.db"
STAGES = {"wishlist", "applied", "interview", "offer", "rejected"}


# ---------- Database helpers ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DATABASE) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                company TEXT NOT NULL,
                role TEXT NOT NULL,
                link TEXT DEFAULT '',
                date TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'wishlist',
                notes TEXT DEFAULT '',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
            """
        )


def clean(data):
    """Check incoming job data. Return a clean dict, or None if invalid."""
    if not data:
        return None
    company = str(data.get("company", "")).strip()
    role = str(data.get("role", "")).strip()
    status = data.get("status", "wishlist")
    if not company or not role or status not in STAGES:
        return None
    return {
        "company": company,
        "role": role,
        "link": str(data.get("link", "")).strip(),
        "date": str(data.get("date", "")).strip(),
        "status": status,
        "notes": str(data.get("notes", "")).strip(),
    }


# ---------- Login protection ----------
def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Not logged in"}), 401
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


# ---------- Pages ----------
@app.route("/")
@login_required
def home():
    return render_template("index.html", username=session["username"])


@app.route("/signup", methods=["GET", "POST"])
def signup():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")

        if len(username) < 3:
            error = "Username must be at least 3 characters."
        elif len(password) < 6:
            error = "Password must be at least 6 characters."
        else:
            db = get_db()
            try:
                cur = db.execute(
                    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                    (username, generate_password_hash(password)),
                )
                db.commit()
            except sqlite3.IntegrityError:
                error = "That username is already taken."
            else:
                session.clear()
                session["user_id"] = cur.lastrowid
                session["username"] = username
                return redirect(url_for("home"))

    return render_template("auth.html", mode="signup", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")

        user = get_db().execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()

        if user and check_password_hash(user["password_hash"], password):
            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect(url_for("home"))
        error = "Wrong username or password."

    return render_template("auth.html", mode="login", error=error)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------- API (every query is limited to the logged-in user) ----------
@app.route("/api/jobs", methods=["GET"])
@login_required
def list_jobs():
    rows = get_db().execute(
        "SELECT id, company, role, link, date, status, notes "
        "FROM jobs WHERE user_id = ? ORDER BY id",
        (session["user_id"],),
    ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.route("/api/jobs", methods=["POST"])
@login_required
def create_job():
    job = clean(request.get_json(silent=True))
    if job is None:
        return jsonify({"error": "Invalid data"}), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO jobs (user_id, company, role, link, date, status, notes) "
        "VALUES (:user_id, :company, :role, :link, :date, :status, :notes)",
        {**job, "user_id": session["user_id"]},
    )
    db.commit()
    job["id"] = cur.lastrowid
    return jsonify(job), 201


@app.route("/api/jobs/<int:job_id>", methods=["PUT"])
@login_required
def update_job(job_id):
    job = clean(request.get_json(silent=True))
    if job is None:
        return jsonify({"error": "Invalid data"}), 400

    db = get_db()
    cur = db.execute(
        "UPDATE jobs SET company=:company, role=:role, link=:link, "
        "date=:date, status=:status, notes=:notes "
        "WHERE id=:id AND user_id=:user_id",
        {**job, "id": job_id, "user_id": session["user_id"]},
    )
    db.commit()
    if cur.rowcount == 0:
        return jsonify({"error": "Not found"}), 404
    job["id"] = job_id
    return jsonify(job)


@app.route("/api/jobs/<int:job_id>", methods=["DELETE"])
@login_required
def delete_job(job_id):
    db = get_db()
    cur = db.execute(
        "DELETE FROM jobs WHERE id = ? AND user_id = ?",
        (job_id, session["user_id"]),
    )
    db.commit()
    if cur.rowcount == 0:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"deleted": job_id})


init_db()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")