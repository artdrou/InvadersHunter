"""
Account-level operations that don't fit a single resource.

POST /account/claim — guest → account migration: bulk-import the local data a
guest accumulated (captures for now; custom invaders later) right after they
register or log in. Authenticated: the data is claimed by the token's user.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.account import ClaimRequest, ClaimResponse
from app.dependencies import get_db, get_current_user
from app.services import progress_service

router = APIRouter(prefix="/account", tags=["Account"])


@router.post("/claim", response_model=ClaimResponse)
def claim_guest_data(
    data: ClaimRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    imported, skipped_duplicates, skipped_missing = progress_service.bulk_claim(
        db, current_user.id, data.captures
    )
    return ClaimResponse(
        captures=imported,
        imported=len(imported),
        skipped_duplicates=skipped_duplicates,
        skipped_missing=skipped_missing,
    )
