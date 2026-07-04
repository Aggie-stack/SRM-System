from app import app
from extensions import db
from models import User
import bcrypt

with app.app_context():
    users = [
        ("director", "@director2026"),
        ("admin",    "@admin2026"),
        ("recep",    "@recap2026"),
    ]

    for username, password in users:
        user = User.query.filter_by(username=username).first()
        if user:
            user.password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            print(f"Reset password for: {username}")
        else:
            print(f"User not found: {username}")

    db.session.commit()
    print("Done. All passwords reset.")
