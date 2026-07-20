import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet

env_path = "/opt/bitacora_diaria/.env"
load_dotenv(dotenv_path=env_path)

APP_PORT = os.getenv("APP_PORT", "8000")
KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID")

# Limpiamos las comillas dobles y simples que arruinan la llave
_raw_key = os.getenv("APP_MASTER_KEY", "").strip(' "\'')
_cipher = Fernet(_raw_key.encode()) if _raw_key else None

def get_secret(env_var_name: str) -> str:
    val = os.getenv(env_var_name, "").strip(' "\'')
    if not val or not _cipher:
        raise ValueError(f"Falta la variable {env_var_name} o la llave maestra en el .env")
    try:
        return _cipher.decrypt(val.encode()).decode()
    except Exception as e:
        raise ValueError(f"❌ Error desencriptando {env_var_name}. La contraseña es inválida. Detalle: {e}")

# Quitamos el fallback a SQLite. O conecta a PostgreSQL o muere intentándolo.
DATABASE_URL = get_secret("ENCRYPTED_DB_URL")
KEYCLOAK_CLIENT_SECRET = get_secret("ENCRYPTED_KEYCLOAK_SECRET")

print(f"✅ Llaves desencriptadas. Conectando motor a: {DATABASE_URL.split(':')[0]}...")