from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from app.dependencies import get_current_user_optional
from app.schemas.contact import ContactRequest
from app.services import contact_service
from app.services.contact_service import TooManyMessages

router = APIRouter(prefix="/contact", tags=["Contact"])


def _client_ip(request: Request) -> str:
    # Behind Railway's proxy the socket peer is an internal address: use the forwarded one.
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "?")


@router.post("/", status_code=202)
def send_contact_message(
    data: ContactRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_optional),
):
    """Public (guests too). Forwards the message to the team inbox."""
    try:
        contact_service.send_message(
            current_user, _client_ip(request),
            data.subject, data.message, schedule=background_tasks.add_task,
            guest_email=data.email, app_version=data.app_version, platform=data.platform,
        )
    except TooManyMessages:
        raise HTTPException(status_code=429, detail="Too many messages, try again later")
    return {"message": "Message sent"}
