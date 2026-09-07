from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

# Instancia global de SQLAlchemy
db = SQLAlchemy()

def utc_now():
    """Retorna datetime actual en UTC naive (sin timezone offset) para compatibilidad con SQLite/PostgreSQL y Python 3.12+."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

