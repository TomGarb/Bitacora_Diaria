import uvicorn
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

# --- IMPORTACIONES ---
from app.database import engine
from app.models.shift import Base
from app.config import KEYCLOAK_SERVER_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET
from app.auth import NotAuthenticatedException
from app.routes import shift, cases, activities, accesses, credentials, extra_tasks, notes, history, master_data, operations, external_cases, metrics

# --- INICIALIZACIÓN ---
Base.metadata.create_all(bind=engine)
app = FastAPI(title="Bitácora Datacenter API")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# --- CARGA DE RUTAS ---
app.include_router(shift.router)
app.include_router(cases.router)
app.include_router(activities.router)
app.include_router(accesses.router)
app.include_router(credentials.router)
app.include_router(extra_tasks.router)
app.include_router(notes.router)
app.include_router(history.router)
app.include_router(master_data.router)
app.include_router(operations.router)
app.include_router(external_cases.router)
app.include_router(metrics.router)

# --- CONFIGURACIÓN DE KEYCLOAK (Ahora está después de los imports, aquí no fallará) ---
KC_BASE = f"{KEYCLOAK_SERVER_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect"
AUTHORIZATION_URL = f"{KC_BASE}/auth"
TOKEN_URL = f"{KC_BASE}/token"
REDIRECT_URI = "https://bitacora-diaria.ctldocbaires.com/callback"

# --- RUTAS DE AUTENTICACIÓN ---
@app.exception_handler(NotAuthenticatedException)
async def auth_exception_handler(request: Request, exc: NotAuthenticatedException):
    return RedirectResponse(url="/login")

@app.get("/", tags=["Autenticación"])
def index_root(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        return RedirectResponse(url="/login")
    return RedirectResponse(url="/shift/")

@app.get("/login", tags=["Autenticación"])
def login_keycloak():
    # Esto imprimirá en los logs el dominio que está detectando Python
    print(f"DEBUG: Iniciando login. REDIRECT_URI configurado: {REDIRECT_URI}")
    
    auth_url = (
        f"{AUTHORIZATION_URL}"
        f"?client_id={KEYCLOAK_CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope=openid profile email"
    )
    return RedirectResponse(url=auth_url)

@app.get("/callback", tags=["Autenticación"])
async def auth_callback(request: Request, code: str):
    async with httpx.AsyncClient() as client:
        payload = {
            "grant_type": "authorization_code",
            "client_id": KEYCLOAK_CLIENT_ID,
            "client_secret": KEYCLOAK_CLIENT_SECRET,
            "code": code,
            "redirect_uri": REDIRECT_URI
        }
        
        resp = await client.post(TOKEN_URL, data=payload)
        
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Fallo en autenticación con Keycloak.")
            
        token_data = resp.json()

    response = RedirectResponse(url="/shift/")
    response.set_cookie(
        key="access_token", 
        value=token_data.get("access_token"), 
        httponly=True,
        secure=True,  # ¡Ahora sí activa esto!
        samesite="lax",
        max_age=28800
    )
    return response

@app.get("/logout", tags=["Autenticación"])
def logout():
    response = RedirectResponse(url="/")
    response.delete_cookie("access_token")
    return response

if __name__ == "__main__":
    uvicorn.run(
        "run:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=False,
        proxy_headers=True, 
        forwarded_allow_ips="*"
    )