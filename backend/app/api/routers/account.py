"""
Account-level operations that don't fit a single resource.

POST /account/claim — guest → account migration: bulk-import the local data a
guest accumulated (captures + custom invaders) right after they register or log
in. Authenticated: the data is claimed by the token's user.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.account import ClaimRequest, ClaimResponse, ClaimedCustomInvader
from app.dependencies import get_db, get_current_user
from app.services import progress_service, custom_invader_service

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
    # Returned in request order, so zipping back onto the temporary local ids is safe.
    created = custom_invader_service.bulk_claim(db, current_user.id, data.custom_invaders)
    return ClaimResponse(
        captures=imported,
        imported=len(imported),
        skipped_duplicates=skipped_duplicates,
        skipped_missing=skipped_missing,
        custom_invaders=[
            ClaimedCustomInvader(local_id=item.local_id, invader=row)
            for item, row in zip(data.custom_invaders, created)
        ],
    )
