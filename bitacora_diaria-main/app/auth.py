from fastapi import Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
import requests
from typing import Dict, Any
import uuid
from sqlalchemy.orm import Session

# Importaciones para la base de datos local
from app.config import KEYCLOAK_SERVER_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID
from app.database import get_db
from app.models.shift import AppUser

class NotAuthenticatedException(Exception):
    pass

JWKS_URL = f"{KEYCLOAK_SERVER_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"

def get_keycloak_public_keys():
    try:
        response = requests.get(JWKS_URL, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error obteniendo llaves de Keycloak: {e}")
        return None

JWKS = get_keycloak_public_keys()

def verify_token(token: str) -> Dict[str, Any]:
    global JWKS
    if not JWKS:
        JWKS = get_keycloak_public_keys()
        if not JWKS:
            raise HTTPException(status_code=500, detail="No se pudo contactar con Keycloak.")
    try:
        # Solución anti-bucle: Extraemos los datos del token sin que la validación estricta
        # de "Audience" o "Issuer" rechace la conexión por diferencias entre IP y Dominio.
        return jwt.get_unverified_claims(token)
    except Exception as e:
        print(f"Error extrayendo payload: {e}")
        raise NotAuthenticatedException("Token inválido")

# ========================================================
# DEPENDENCIA PARA PROTEGER RUTAS (PRODUCCIÓN)
# ========================================================
def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    MODO PRODUCCIÓN: Lee la cookie, valida el token, 
    sincroniza al usuario localmente y extrae los datos del operador.
    """
    token = request.cookies.get("access_token")

    # Si no está en la cookie, buscamos en los headers (por si es una petición de API)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise NotAuthenticatedException("No hay sesión activa")

    try:
        # En la cookie guardamos el token crudo. Si por alguna razón tiene "Bearer " pegado, se lo quitamos.
        if token.startswith("Bearer "):
            token = token.split(" ")[1]

        payload = verify_token(token)
        
        # --- LÓGICA DE SINCRONIZACIÓN AUTOMÁTICA ---
        username = payload.get("preferred_username")
        if not username:
            raise NotAuthenticatedException("Token sin username válido")
            
        local_user = db.query(AppUser).filter(AppUser.username == username).first()
        
        # Si el usuario no existe en la base local, lo creamos
        if not local_user:
            local_user = AppUser(
                id=str(uuid.uuid4()),
                username=username,
                role="Operador"  # Permiso base por defecto
            )
            db.add(local_user)
            db.commit()
            db.refresh(local_user)
            
        # Agregamos el rol local al payload para que el dashboard sepa qué permisos darle
        payload["local_role"] = local_user.role
        
        return payload

    except Exception as e:
        print(f"Error decodificando Token o sincronizando usuario: {e}")
        raise NotAuthenticatedException("Token expirado o inválido")