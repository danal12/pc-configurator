from flask import Flask, render_template, jsonify, request
import sqlite3
import json
from datetime import datetime

app = Flask(__name__)

DB = "database.db"

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        name TEXT,
        price REAL,
        specs TEXT,
        platform TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS builds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        date TEXT,
        purpose TEXT,
        budget REAL,
        components TEXT,
        total_price REAL
    )
    """)

    conn.commit()
    conn.close()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/components")
def components():
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT type,name,price,specs,platform FROM components")
    rows = c.fetchall()
    conn.close()

    data = {}

    for r in rows:
        t = r["type"]
        data.setdefault(t, []).append({
            "name": r["name"],
            "price": r["price"],
            "specs": r["specs"],
            "platform": r["platform"]
        })

    return jsonify(data)


@app.route("/api/save", methods=["POST"])
def save():
    data = request.get_json()

    conn = get_db()
    c = conn.cursor()

    c.execute("""
        INSERT INTO builds (user_id,date,purpose,budget,components,total_price)
        VALUES (?,?,?,?,?,?)
    """, (
        data.get("user_id"),
        datetime.now().strftime("%d.%m.%Y %H:%M"),
        data.get("purpose"),
        data.get("budget"),
        json.dumps(data.get("components")),
        data.get("total")
    ))

    conn.commit()
    conn.close()

    return jsonify({"status": "ok"})


@app.route("/api/mybuilds/<user_id>")
def mybuilds(user_id):

    conn = get_db()
    c = conn.cursor()

    c.execute("""
        SELECT id,date,purpose,components,total_price
        FROM builds
        WHERE user_id=?
        ORDER BY id DESC
    """, (user_id,))

    rows = c.fetchall()
    conn.close()

    out = []

    for r in rows:
        try:
            comps = json.loads(r["components"])
        except:
            comps = {}

        out.append({
            "id": r["id"],
            "date": r["date"],
            "purpose": r["purpose"],
            "components": comps,
            "total": r["total_price"]
        })

    return jsonify(out)


@app.route("/api/delete_build", methods=["POST"])
def delete():
    data = request.get_json()

    conn = get_db()
    c = conn.cursor()

    c.execute("DELETE FROM builds WHERE id=?", (data["id"],))

    conn.commit()
    conn.close()

    return jsonify({"status": "deleted"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000)