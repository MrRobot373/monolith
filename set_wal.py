import sqlite3
conn = sqlite3.connect(r'C:\Users\Yash\.config\openwork\runtime.sqlite')
conn.execute('PRAGMA journal_mode=WAL')
conn.execute('PRAGMA synchronous=NORMAL')
conn.commit()
print("Set to WAL mode.")
