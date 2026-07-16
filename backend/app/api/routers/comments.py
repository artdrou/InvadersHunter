"""
Invader comment wall.

- GET  /invaders/{id}/comments       public — guests read the wall too
- POST /invaders/{id}/comments       authenticated — auto-moderated at creation
- POST /comments/{id}/report         authenticated — queue for admin review
- DELETE /comments/{id}              owner or admin
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas.comment import CommentCreate, CommentOut
from app.dependencies import get_db, get_current_user
from app.services import comment_service
from app.services.comment_service import InvaderMissing, CommentMissing, NotCommentOwner

router = APIRouter(tags=["Comments"])


def _to_out(comment, username: str) -> CommentOut:
    return CommentOut(
        id=comment.id,
        invader_id=comment.invader_id,
        user_id=comment.user_id,
        username=username,
        body=comment.body,
        status=comment.status,
        created_at=comment.created_at,
    )


@router.get("/invaders/{invader_id}/comments", response_model=List[CommentOut])
def list_comments(invader_id: int, db: Session = Depends(get_db)):
    try:
        rows = comment_service.list_for_invader(db, invader_id)
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    return [_to_out(comment, username) for comment, username in rows]


@router.post("/invaders/{invader_id}/comments", response_model=CommentOut)
def create_comment(
    invader_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        comment = comment_service.create(db, current_user, invader_id, data.body.strip())
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    return _to_out(comment, current_user.username)


@router.post("/comments/{comment_id}/report", response_model=CommentOut)
def report_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        comment = comment_service.report(db, comment_id)
    except CommentMissing:
        raise HTTPException(status_code=404, detail="Comment not found")
    # username of the author, not the reporter
    from app.models.user import User
    author = db.query(User).filter(User.id == comment.user_id).first()
    return _to_out(comment, author.username if author else "?")


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        comment_service.delete(db, comment_id, current_user)
    except CommentMissing:
        raise HTTPException(status_code=404, detail="Comment not found")
    except NotCommentOwner:
        raise HTTPException(status_code=403, detail="Not allowed")
    return {"message": "Comment deleted"}
