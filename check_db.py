import sqlite3

conn = sqlite3.connect(r'C:\Users\Yash\.config\openwork\runtime.sqlite')
cur = conn.cursor()
cur.execute("SELECT sql FROM sqlite_master WHERE type='table'")
schemas = cur.fetchall()
print("Schemas:")
for s in schemas:
    print(s[0])

cur.execute("PRAGMA journal_mode")
print("\nJournal Mode:", cur.fetchone()[0])

cur.execute("PRAGMA synchronous")
print("Synchronous:", cur.fetchone()[0])
