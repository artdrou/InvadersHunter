from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.schemas.friend import FriendRequestCreate, FriendRequestResult, FriendsOverview, FriendProfileOut
from app.services import friend_service
from app.services.friend_service import (
    FriendUserMissing, CannotFriendSelf, AlreadyFriends, InviteAlreadySent, FriendshipMissing, NotFriends,
)
from app.services.user_service import UserMissing

router = APIRouter(prefix="/friends", tags=["Friends"])


@router.get("/", response_model=FriendsOverview)
def get_overview(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Friends, invites received and invites sent."""
    return friend_service.overview(db, current_user)


@router.post("/requests", response_model=FriendRequestResult)
def send_request(
    body: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # `detail` codes are stable: the app maps them to translated messages.
    try:
        return friend_service.send_request(db, current_user, body.username)
    except FriendUserMissing:
        raise HTTPException(status_code=404, detail="user_not_found")
    except CannotFriendSelf:
        raise HTTPException(status_code=400, detail="self")
    except AlreadyFriends:
        raise HTTPException(status_code=409, detail="already_friends")
    except InviteAlreadySent:
        raise HTTPException(status_code=409, detail="already_sent")


@router.post("/requests/{friendship_id}/accept")
def accept_request(friendship_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        friend_service.accept_request(db, current_user, friendship_id)
    except FriendshipMissing:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"message": "Friend request accepted"}


@router.delete("/{friendship_id}")
def remove(friendship_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Decline an invite, cancel one you sent, or remove a friend."""
    try:
        friend_service.remove(db, current_user, friendship_id)
    except FriendshipMissing:
        raise HTTPException(status_code=404, detail="Friendship not found")
    return {"message": "Removed"}


@router.get("/users/{user_id}/profile", response_model=FriendProfileOut)
def get_friend_profile(user_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """A friend's game stats and flashed invaders (for their map). Friends only."""
    try:
        return friend_service.friend_profile(db, current_user, user_id)
    except NotFriends:
        raise HTTPException(status_code=403, detail="Not friends")
    except UserMissing:
        raise HTTPException(status_code=404, detail="User not found")
