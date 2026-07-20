import os
from getpass import getpass
from cryptography.fernet import Fernet
 
print("=====================================================")
print("🛡️  GENERADOR DE CONFIGURACIÓN V4 (Bitácora Diaria) 🛡️")
print("=====================================================\n")
 
# Detectamos la ruta raíz del proyecto (Asumiendo que el script está en la raíz)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
 
# 1. Generamos la nueva llave maestra
master_key = Fernet.generate_key()
cipher = Fernet(master_key)
 
print("--- 1. VARIABLES ESTRUCTURALES (Públicas) ---")
app_port = input("Puerto de la App (ej. 8000 o 5000): ") or "8000"
kc_url = input("URL de Keycloak (ej. https://auth.ctldocbaires.com): ")
kc_realm = input("Realm de Keycloak (ej. operaciones): ")
kc_client = input("Client ID de Keycloak (ej. bitacora-app): ")
 
print("\n--- 2. CREDENCIALES DE BASE DE DATOS (Se encriptarán) ---")
# Base de Datos en otra VM
db_user = input("DB Usuario (ej. bitacora_diaria_user): ")
db_pass = getpass("DB Contraseña (no se verá al escribir): ")
db_host = input("DB IP o Host de la VM (ej. 192.168.100.50): ")
db_port = input("DB Puerto (ej. 5432): ")
db_name = input("Base de datos (ej. bitacora_diaria_bd): ")
 
# Construcción y encriptación de la URL de PostgreSQL
db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
encrypted_db = cipher.encrypt(db_url.encode()).decode()
 
# Keycloak Secret
print("\n--- 3. AUTENTICACIÓN SECRETA (Keycloak) ---")
kc_secret = getpass("Client Secret de Keycloak: ")
encrypted_kc_secret = cipher.encrypt(kc_secret.encode()).decode()
 
# 4. Escribimos automáticamente el archivo .env
env_path = os.path.join(BASE_DIR, '.env')
with open(env_path, 'w') as env_file:
    env_file.write(f'APP_PORT="{app_port}"\n')
    env_file.write(f'APP_MASTER_KEY="{master_key.decode()}"\n\n')
    
    env_file.write(f'KEYCLOAK_SERVER_URL="{kc_url}"\n')
    env_file.write(f'KEYCLOAK_REALM="{kc_realm}"\n')
    env_file.write(f'KEYCLOAK_CLIENT_ID="{kc_client}"\n\n')
    
    env_file.write(f'ENCRYPTED_DB_URL="{encrypted_db}"\n')
    env_file.write(f'ENCRYPTED_KEYCLOAK_SECRET="{encrypted_kc_secret}"\n')
 
print("\n" + "="*55)
print(f"✅ ¡ÉXITO! Archivo .env generado en: {env_path}")
print("="*55)
print("💡 TIP PARA EL SERVICIO DE LINUX (systemd):")
print("Asegúrate de incluir esta línea en tu archivo bitacora.service:")
print(f"EnvironmentFile={env_path}")
print("=====================================================\n")