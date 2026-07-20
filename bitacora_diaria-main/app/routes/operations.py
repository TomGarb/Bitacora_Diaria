from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

router = APIRouter(prefix="/operations", tags=["Unified Workspace"])
templates = Jinja2Templates(directory="app/templates")

@router.get("/")
async def render_workspace(request: Request):
    return templates.TemplateResponse("master_operations.html", {"request": request})